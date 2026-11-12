import {
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from "next/constants";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const { decide, wrap, init, capture, flush } = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
  decide: vi.fn(),
  wrap: vi.fn(
    (config, _options?: { errorHandler?: (error: Error) => void }) => config,
  ),
}));
vi.mock("@sentry/nextjs", () => ({ init, captureException: capture, flush }));
vi.mock("@flags-sdk/vercel", () => ({
  vercelAdapter: () => ({ decide, config: { reportValue: false } }),
}));
vi.mock("@sentry/nextjs/config", () => ({ withSentryConfig: wrap }));

beforeEach(() => {
  vi.resetModules();
  decide.mockReset().mockResolvedValue(true);
  wrap.mockClear();
  init.mockClear();
  capture.mockClear();
  flush.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  for (const [key, value] of Object.entries({
    NODE_ENV: "production",
    BETTER_AUTH_URL: "https://shelve.games",
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    NEXT_PUBLIC_SENTRY_DSN: `https://${"b".repeat(32)}@o123.ingest.us.sentry.io/456`,
    SENTRY_INGEST_HOST: "o123.ingest.us.sentry.io",
    SENTRY_ORG: "example",
    SENTRY_PROJECT: "shelve-games",
    SENTRY_AUTH_TOKEN: "fake-upload-token",
    CI: "1",
    VERCEL_DEPLOYMENT_ID: "dpl_test123",
    VITEST: "",
    E2E_TEST: "",
    STORYBOOK: "",
    GITHUB_ACTIONS: "",
  }))
    vi.stubEnv(key, value);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function configure(phase = PHASE_PRODUCTION_BUILD) {
  const { default: configureNext } = await import("../../next.config");
  return configureNext(phase);
}

test("on snapshots one identity-free decision for runtime, CSP and private uploads", async () => {
  const config = await configure();
  expect(config.env?.NEXT_PUBLIC_SENTRY_ENABLED).toBe("1");
  expect(decide).toHaveBeenCalledOnce();
  expect(decide.mock.calls[0][0]).toMatchObject({
    key: "sentry-monitoring",
    defaultValue: true,
  });
  expect(decide.mock.calls[0][0].entities).toBeUndefined();
  expect([...decide.mock.calls[0][0].headers]).toEqual([]);
  expect(wrap).toHaveBeenCalledOnce();
  const headers = await config.headers?.();
  expect(
    headers?.[0].headers.find(
      (h) => h.key === "Content-Security-Policy-Report-Only",
    )?.value,
  ).toContain("https://o123.ingest.us.sentry.io");
  // Existing deployment config is a snapshot; later provider changes cannot alter it.
  decide.mockResolvedValue(false);
  expect(config.env?.NEXT_PUBLIC_SENTRY_ENABLED).toBe("1");
  const rebuilt = await configure();
  expect(rebuilt.env?.NEXT_PUBLIC_SENTRY_ENABLED).toBe("0");
});

test("off disables browser/server snapshot, CSP ingest access and uploads", async () => {
  decide.mockResolvedValue(false);
  const config = await configure();
  expect(config.env).toEqual({
    NEXT_PUBLIC_SENTRY_ENABLED: "0",
    NEXT_PUBLIC_SENTRY_DSN: "",
    NEXT_PUBLIC_SENTRY_RELEASE: "",
  });
  expect(wrap).not.toHaveBeenCalled();
  const headers = await config.headers?.();
  expect(
    headers?.[0].headers.find(
      (h) => h.key === "Content-Security-Policy-Report-Only",
    )?.value,
  ).not.toContain("sentry.io");
});

test.each([
  "missing",
  "failed",
])("a %s provider decision uses the requested default-on behavior", async (kind) => {
  if (kind === "missing") decide.mockResolvedValue(undefined);
  else decide.mockRejectedValue(new Error("Flag provider unavailable"));
  expect((await configure()).env?.NEXT_PUBLIC_SENTRY_ENABLED).toBe("1");
});

test.each([
  { VERCEL: "" },
  { VERCEL_ENV: "preview" },
  { NODE_ENV: "development" },
  { BETTER_AUTH_URL: "http://localhost:3000" },
  { E2E_TEST: "1" },
  { VITEST: "true" },
  { STORYBOOK: "1" },
  { GITHUB_ACTIONS: "true" },
  { CI: "true" },
  { NEXT_PUBLIC_SENTRY_DSN: "https://invalid.example" },
])("nonproduction/invalid context never evaluates flags or uploads despite inherited credentials: %j", async (override) => {
  for (const [key, value] of Object.entries(override)) vi.stubEnv(key, value);
  expect((await configure()).env?.NEXT_PUBLIC_SENTRY_ENABLED).toBe("0");
  expect(decide).not.toHaveBeenCalled();
  expect(wrap).not.toHaveBeenCalled();
});

test("starting the server never re-evaluates the remote flag or uploads maps", async () => {
  await configure(PHASE_PRODUCTION_SERVER);
  expect(decide).not.toHaveBeenCalled();
  expect(wrap).not.toHaveBeenCalled();
});

test.each([
  "0",
  "1",
])("server capture follows the built snapshot %s without re-evaluating the flag", async (enabled) => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("NEXT_PUBLIC_SENTRY_ENABLED", enabled);
  decide.mockResolvedValue(enabled !== "1");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { register } = await import("../instrumentation");
  const { reportOperationalError } = await import("./operational-errors");
  await register();
  reportOperationalError(
    "feedback.write",
    "unexpected",
    new Error("Synthetic failure"),
  );
  expect(init).toHaveBeenCalledTimes(enabled === "1" ? 1 : 0);
  expect(capture).toHaveBeenCalledTimes(enabled === "1" ? 1 : 0);
  expect(decide).not.toHaveBeenCalled();
});

test("source-map upload failures stop the build without exposing provider errors", async () => {
  await configure();
  const handler = wrap.mock.calls[0][1]?.errorHandler;
  expect(handler).toBeTypeOf("function");
  expect(() => handler?.(new Error("provider-token-private-detail"))).toThrow(
    /^Private source-map upload failed \(CLI exit unknown\)$/,
  );
});

test.each([
  21, 40, 53,
])("upload diagnostics expose only the numeric CLI exit code %i", async (exitCode) => {
  await configure();
  const handler = wrap.mock.calls[0][1]?.errorHandler;
  expect(() =>
    handler?.(
      Object.assign(new Error("provider-token-private-detail"), { exitCode }),
    ),
  ).toThrow(`Private source-map upload failed (CLI exit ${exitCode})`);
});

test.each([
  "provider-token-private-detail",
  NaN,
  Infinity,
])("noninteger upload diagnostics stay private: %s", async (exitCode) => {
  await configure();
  const handler = wrap.mock.calls[0][1]?.errorHandler;
  expect(() =>
    handler?.(
      Object.assign(new Error("provider-token-private-detail"), { exitCode }),
    ),
  ).toThrow("Private source-map upload failed (CLI exit unknown)");
});
