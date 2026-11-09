import { inspect } from "node:util";
import { afterEach, expect, test, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { createAuth } from "./auth";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test.each([
  "endpoint",
  "rate-limit",
  "session",
])("%s database failures retain error severity without logging sensitive error details", async (failure) => {
  // Exercise endpoint failures separately from the rate-limit store.
  vi.stubEnv("E2E_TEST", failure === "rate-limit" ? "0" : "1");
  vi.stubEnv("E2E_SUPPORT_URL", "http://localhost:3001");
  for (const key of ["VERCEL", "VERCEL_ENV", "DATABASE_URL"])
    vi.stubEnv(key, "");
  const logs = (["error", "warn", "log", "info", "debug"] as const).map(
    (method) => vi.spyOn(console, method).mockImplementation(() => {}),
  );
  const database = await createTestDb();
  let verification = "";
  const auth = createAuth(database, async (email) => {
    verification = email.text.match(/https?:\S+/)?.[0] ?? "";
  });
  let cookie = "";
  if (failure === "session") {
    await auth.api.signUpEmail({
      body: {
        name: "Player",
        email: "auth-recipient@example.com",
        password: "password123",
      },
    });
    const verified = await auth.handler(new Request(verification));
    expect(verified.status).toBe(302);
    cookie = verified.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; ");
  }
  const sentinel = "PRIVATE-auth-database-sentinel";
  const error = new Error(sentinel, { cause: new Error(sentinel) });
  Object.defineProperty(error, "query", { value: sentinel });
  vi.spyOn(database, "select").mockImplementation(() => {
    throw error;
  });

  const response =
    failure === "session"
      ? await auth.handler(
          new Request("http://localhost:3000/api/auth/get-session", {
            headers: { cookie },
          }),
        )
      : await auth.fetch(
          new Request("http://localhost:3000/api/auth/sign-in/email", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "http://localhost:3000",
            },
            body: JSON.stringify({
              email: "auth-recipient@example.com",
              password: "password123",
            }),
          }),
        );

  expect(response.status).toBe(500);
  expect(logs[0]).toHaveBeenCalledWith("Authentication diagnostic");
  expect(
    inspect(
      logs.flatMap((log) => log.mock.calls),
      {
        depth: null,
        showHidden: true,
      },
    ),
  ).not.toContain(sentinel);
  expect(await response.text()).not.toContain(sentinel);
});

test.each([
  "error",
  "warn",
] as const)("OAuth %s diagnostics discard provider input and preserve redirects", async (severity) => {
  const logs = (["error", "warn", "log", "info", "debug"] as const).map(
    (method) => vi.spyOn(console, method).mockImplementation(() => {}),
  );
  vi.stubEnv("GOOGLE_CLIENT_ID", "local-test-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "local-test-secret");
  const auth = createAuth(await createTestDb(), async () => {});
  const sentinel = "PRIVATE-auth-provider-sentinel";
  let state = "";
  let cookie = "";
  if (severity === "warn") {
    const start = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "/",
          errorCallbackURL: "/sign-in",
        }),
      }),
    );
    expect(start.status).toBe(200);
    state = new URL((await start.json()).url).searchParams.get("state") ?? "";
    cookie = start.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; ");
  }
  const query = new URLSearchParams(
    severity === "error"
      ? [["error", sentinel]]
      : [
          ["state", state],
          ["code", "synthetic-code"],
        ],
  );
  const provider = severity === "error" ? "google" : sentinel;
  const response = await auth.handler(
    new Request(
      `http://localhost:3000/api/auth/callback/${provider}?${query}`,
      {
        headers: { cookie },
      },
    ),
  );
  expect(response.status).toBe(302);
  expect(
    new URL(
      response.headers.get("location") ?? "",
      "http://localhost:3000",
    ).searchParams.get("error"),
  ).toBe(severity === "error" ? "state_not_found" : "oauth_provider_not_found");
  expect(logs[severity === "error" ? 0 : 1]).toHaveBeenCalledWith(
    "Authentication diagnostic",
  );
  expect(
    logs
      .flatMap((log) => log.mock.calls)
      .every(
        (args) => args.length === 1 && args[0] === "Authentication diagnostic",
      ),
  ).toBe(true);
});
