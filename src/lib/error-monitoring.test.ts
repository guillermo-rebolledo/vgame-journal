import * as Sentry from "@sentry/nextjs";
import { afterEach, expect, test, vi } from "vitest";
import { onRequestError, register } from "../instrumentation";
import {
  createErrorFilter,
  linkMonitoringError,
  sanitizeErrorEvent,
} from "./error-monitoring";
import { ExpectedError } from "./expected-error";
import { monitoringConfig } from "./monitoring-config";
import { monitoringOptions } from "./monitoring-options";
import {
  installErrorCapture,
  observeOperation,
  operationalCode,
  reportOperationalError,
} from "./operational-errors";

const release = "a".repeat(40);
const dsn = `https://${"b".repeat(32)}@o123.ingest.us.sentry.io/456`;
const production = {
  BETTER_AUTH_URL: "https://shelve.games",
  NODE_ENV: "production",
  VERCEL: "1",
  VERCEL_ENV: "production",
  SENTRY_ENABLED: "1",
  SENTRY_PREREQUISITES_VERIFIED: "1",
  NEXT_PUBLIC_SENTRY_DSN: dsn,
  SENTRY_INGEST_HOST: "o123.ingest.us.sentry.io",
  VERCEL_GIT_COMMIT_SHA: release,
};
afterEach(async () => {
  await Sentry.close(2000);
  installErrorCapture(() => {});
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test.each([
  { BETTER_AUTH_URL: "http://localhost:3000" },
  { SENTRY_ENABLED: "" },
  { SENTRY_PREREQUISITES_VERIFIED: "" },
  { VERCEL: "" },
  { VERCEL_ENV: "preview" },
  { NODE_ENV: "development" },
  { CI: "true" },
  { CI: "1" },
  { CI: "1", VERCEL_DEPLOYMENT_ID: "invalid" },
  { CI: "1", VERCEL_DEPLOYMENT_ID: "dpl_test123", GITHUB_ACTIONS: "true" },
  { CI: "1", VERCEL_DEPLOYMENT_ID: "dpl_test123", VERCEL_ENV: "preview" },
  { CI: "1", VERCEL_DEPLOYMENT_ID: "dpl_test123", E2E_TEST: "1" },
  { VITEST: "true" },
  { STORYBOOK: "1" },
  { E2E_TEST: "1" },
  { NEXT_PUBLIC_SENTRY_DSN: "" },
  { SENTRY_INGEST_HOST: "evil.example" },
  { VERCEL_GIT_COMMIT_SHA: "private@example.com" },
  { NEXT_PUBLIC_SENTRY_DSN: `${dsn}?token=private` },
  { NEXT_PUBLIC_SENTRY_DSN: dsn.replace("https:", "http:") },
  { NEXT_PUBLIC_SENTRY_DSN: dsn.replace("/456", "/456%2fsecret") },
])("inherited credentials cannot bypass a disabled context: %j", async (override) => {
  expect(monitoringConfig({ ...production, ...override })).toBeNull();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  for (const [key, value] of Object.entries({ ...production, ...override }))
    vi.stubEnv(key, value);
  await register();
  expect(fetch).not.toHaveBeenCalled();
});

test("Vercel production builds may derive browser config despite CI=1", () => {
  expect(
    monitoringConfig({
      ...production,
      CI: "1",
      VERCEL_DEPLOYMENT_ID: "dpl_test123",
    }),
  ).toEqual({ dsn, release, origin: "https://o123.ingest.us.sentry.io" });
});

test("only the exact approved HTTPS origin and same commit are exposed", () => {
  expect(monitoringConfig(production)).toEqual({
    dsn,
    release,
    origin: "https://o123.ingest.us.sentry.io",
  });
});

function fakeWire() {
  const wire: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      wire.push(options.body);
      return new Response(null, { status: 200 });
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  Sentry.init({
    ...monitoringOptions(dsn, release),
    enableOpenTelemetrySetup: false,
  });
  installErrorCapture((error, operation, code) => {
    Sentry.captureException(error ?? new Error("Operational failure"), {
      tags: { operation, code },
    });
  });
  return wire;
}

test("domain → translation → hook sends one sanitized origin event; independent identical errors remain separate", async () => {
  const wire = fakeWire();
  const original = new Error("private notes SQL password email@example.com");
  original.name = "private custom error";
  original.stack =
    "private\n    at query (/Users/private/project/.next/server/chunks/origin.js:42:7)";
  const operation = observeOperation("journal.set", async () => {
    throw original;
  });
  await expect(operation()).rejects.toBe(original);
  await onRequestError(
    linkMonitoringError(new Error("translated SQL"), original),
    {
      path: "/api/calendar/private?token=secret",
      method: "POST",
      headers: { cookie: "secret" },
    },
    {
      routerKind: "App Router",
      routeType: "action",
      routePath: "/u/[username]",
      revalidateReason: undefined,
    },
  );
  const independent = new Error(original.message);
  independent.stack = original.stack;
  reportOperationalError(
    "journal.set",
    operationalCode(independent),
    independent,
  );
  await Sentry.flush(2000);
  expect(wire).toHaveLength(2);
  for (const body of wire) {
    expect(body).not.toMatch(
      /private|secret|SQL|password|email@|cookie|username|Users|translated/,
    );
    const lines = body.split("\n");
    expect(JSON.parse(lines[1])).toEqual({ type: "event" });
    expect(JSON.parse(lines[2])).toMatchObject({
      environment: "production",
      release,
      tags: { operation: "journal.set", code: "unexpected" },
      exception: {
        values: [
          {
            type: "Error",
            value: "Unexpected application failure",
            stacktrace: {
              frames: [
                {
                  filename: "app:///.next/server/chunks/origin.js",
                  lineno: 42,
                  colno: 7,
                },
              ],
            },
          },
        ],
      },
    });
  }
});

test("expected errors and framework control flow are filtered while dependency timeouts survive", async () => {
  const wire = fakeWire();
  Sentry.captureException(new ExpectedError("Private validation"));
  Sentry.captureException(
    Object.assign(new Error("redirect"), {
      digest: "NEXT_REDIRECT;replace;/secret;307;",
    }),
  );
  reportOperationalError(
    "game_source.request",
    "timeout",
    new DOMException("private endpoint", "TimeoutError"),
  );
  await Sentry.flush(2000);
  expect(wire).toHaveLength(1);
  expect(wire[0]).toContain('"code":"timeout"');
});

test("complete wire envelopes exclude arbitrary context and every non-error product", async () => {
  const wire = fakeWire();
  const client = Sentry.getClient();
  client?.captureEvent({
    message: "private notes",
    user: { email: "private@example.com", ip_address: "1.2.3.4" },
    request: {
      url: "https://shelve.games/api/calendar/token?reset=private",
      headers: { cookie: "private" },
      data: "private feedback",
    },
    extra: { sql: "private SQL" },
    contexts: { custom: { secret: "private" } },
    breadcrumbs: [{ message: "private" }],
    tags: { username: "private", operation: "private" },
    exception: {
      values: [
        {
          type: "private",
          value: "private",
          stacktrace: {
            frames: [
              { filename: "https://evil.example/private.js" },
              {
                filename:
                  "https://shelve.games/_next/static/chunks/app.js?private#private",
                lineno: 10,
                colno: 2,
                vars: { notes: "private" },
                pre_context: ["private"],
                debug_id: `${"a".repeat(8)}-aaaa-aaaa-aaaa-${"a".repeat(12)}`,
              },
            ],
          },
        },
      ],
    },
  });
  Sentry.logger.info("private log");
  Sentry.metrics.count("private metric", 1);
  await Sentry.flush(2000);
  expect(wire).toHaveLength(1);
  expect(wire[0]).not.toMatch(
    /private|evil|notes|feedback|cookie|reset|sql|user|breadcrumbs|contexts/,
  );
  expect(wire[0]).toContain("app.js");
  const transport = monitoringOptions(dsn, release).transport?.({
    url: "https://example.invalid",
    recordDroppedEvent: () => {},
  });
  await transport?.send([
    { event_id: "a".repeat(32), sent_at: new Date().toISOString() },
    [
      [
        { type: "session" },
        {
          sid: "a".repeat(32),
          init: true,
          started: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          status: "ok",
          errors: 0,
          attrs: { release },
        },
      ],
    ],
  ]);
  await transport?.send([
    { event_id: "a".repeat(32), sent_at: new Date().toISOString() },
    [[{ type: "attachment", filename: "private", length: 7 }, "private"]],
  ]);
  expect(wire).toHaveLength(1);
});

test("malformed events fail closed; arbitrary digests do not suppress client failures", () => {
  const event = {
    type: undefined,
    exception: { values: [] },
  } satisfies Sentry.ErrorEvent;
  expect(
    sanitizeErrorEvent(
      Object.defineProperty({}, "type", {
        get() {
          throw new Error("private");
        },
      }) as Sentry.ErrorEvent,
      release,
    ),
  ).toBeNull();
  const filter = createErrorFilter(release);
  expect(
    filter(event, {
      originalException: Object.assign(new Error("client failure"), {
        digest: "123",
      }),
    }),
  ).not.toBeNull();
  expect(
    filter(event, { originalException: "private arbitrary thrown value" }),
  ).not.toBeNull();
});

test("capture/transport failures cannot change operation results or original errors", async () => {
  fakeWire();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("transport private")),
  );
  const original = new Error("original");
  const observed = observeOperation("feedback.write", async () => {
    throw original;
  });
  await expect(observed()).rejects.toBe(original);
  await expect(Sentry.flush(2000)).resolves.toBe(true);
  installErrorCapture(() => {
    throw new Error("SDK failed");
  });
  await expect(observed()).rejects.toBe(original);
});

test("caught Feedback write and notification failures send sanitized events without changing recovery", async () => {
  const { createTestDb } = await import("@/test/db");
  const { createFeedback } = await import("./feedback");
  const { user, feedback } = await import("@/db/schema");
  const database = await createTestDb();
  const author = {
    id: "private-id",
    username: "private-name",
    email: "private@example.com",
  };
  await database.insert(user).values({ ...author, name: "Private" });
  const wire = fakeWire();
  vi.stubEnv("FEEDBACK_EMAIL", "private@example.com");
  const send = vi.fn().mockRejectedValue(new Error("private provider secret"));
  const submit = createFeedback(database, send);
  const input = {
    type: "bug",
    message: "private Feedback writing",
    path: "/journal",
  };
  await expect(submit(author, input)).resolves.toBeUndefined();
  expect(await database.select().from(feedback)).toHaveLength(1);
  vi.spyOn(database, "transaction").mockRejectedValue(
    new Error("private SQL parameters"),
  );
  await expect(submit(author, input)).resolves.toEqual({
    error: "Could not send feedback. Please try again.",
  });
  await Sentry.flush(2000);
  expect(wire).toHaveLength(2);
  expect(wire.join()).not.toMatch(/private|provider secret|SQL|parameters/);
  expect(wire[0]).toContain('"operation":"feedback.notification"');
  expect(wire[1]).toContain('"operation":"feedback.write"');
  expect(send).toHaveBeenCalledOnce();
});

test("build gate exposes only public config, exact CSP origin and no map plugin without upload credentials", async () => {
  for (const [key, value] of Object.entries(production)) vi.stubEnv(key, value);
  for (const key of [
    "CI",
    "GITHUB_ACTIONS",
    "VITEST",
    "STORYBOOK",
    "E2E_TEST",
    "SENTRY_AUTH_TOKEN",
  ])
    vi.stubEnv(key, "");
  vi.stubEnv("CI", "1");
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_test123");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.resetModules();
  const { default: config } = await import("../../next.config");
  const headers = await config.headers?.();
  expect(
    headers?.[0].headers.find(
      (h) => h.key === "Content-Security-Policy-Report-Only",
    )?.value,
  ).toContain(
    "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com https://o123.ingest.us.sentry.io;",
  );
  expect(config.env).toEqual({
    NEXT_PUBLIC_SENTRY_ENABLED: "1",
    NEXT_PUBLIC_SENTRY_DSN: dsn,
    NEXT_PUBLIC_SENTRY_RELEASE: release,
  });
  expect(config).not.toHaveProperty("productionBrowserSourceMaps", true);
  expect(config).not.toHaveProperty("compiler.runAfterProductionCompile");
});
