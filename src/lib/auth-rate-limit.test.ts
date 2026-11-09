import { afterEach, expect, test, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { createAuth } from "./auth";

const mailbox = async () => {};
const attempt = (
  auth: ReturnType<typeof createAuth>,
  path = "/sign-in/email",
  headers = {},
) => {
  const get = path === "/verify-email" || path.startsWith("/reset-password/");
  return auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: get ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        ...headers,
      },
      // Invalid payloads still consume attempts, without password hashing or email delivery.
      body: get ? undefined : "{}",
    }),
  );
};

afterEach(() => vi.unstubAllEnvs());

test("auth limits persist across instances in one store and are isolated from other stores", async () => {
  const db = await createTestDb();
  const first = createAuth(db, mailbox);
  for (let i = 0; i < 3; i++) expect((await attempt(first)).status).toBe(400);
  expect((await attempt(createAuth(db, mailbox))).status).toBe(429);
  expect(
    (await attempt(createAuth(await createTestDb(), mailbox))).status,
  ).toBe(400);
});

test.each([
  "/sign-in/email",
  "/sign-in/social",
  "/sign-up/email",
  "/request-password-reset",
  "/reset-password",
  "/reset-password/invalid-token",
  "/send-verification-email",
  "/verify-email",
])("concurrent requests to %s share exactly three attempts, including after expiry", async (path) => {
  const db = await createTestDb();
  const instances = Array.from({ length: 6 }, () => createAuth(db, mailbox));
  let now = Date.now();
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  try {
    const burst = () =>
      Promise.all(
        Array.from({ length: 18 }, (_, i) => attempt(instances[i % 6], path)),
      );
    for (let round = 0; round < 2; round++) {
      const responses = await burst();
      expect(responses.filter((r) => r.status !== 429)).toHaveLength(3);
      expect(responses.filter((r) => r.status === 429)).toHaveLength(15);
      const blocked = responses.find((r) => r.status === 429);
      expect(blocked).toBeDefined();
      if (!blocked) throw new Error("Expected a throttled response");
      expect(await blocked.json()).toEqual({
        message: "Too many requests. Please try again later.",
      });
      expect(Number(blocked.headers.get("x-retry-after"))).toBeGreaterThan(0);
      now += 60_000;
    }
  } finally {
    clock.mockRestore();
  }
});

test.each([
  "production",
  "preview",
])("E2E_TEST cannot disable limiting on Vercel %s", async (environment) => {
  vi.stubEnv("E2E_TEST", "1");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", environment);
  // Even copied local harness configuration must not bypass a hosted deployment.
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("E2E_SUPPORT_URL", "http://127.0.0.1:3101");
  const auth = createAuth(await createTestDb(), mailbox);
  const responses = await Promise.all(
    Array.from({ length: 5 }, () => attempt(auth)),
  );
  expect(responses.filter((r) => r.status === 429)).toHaveLength(2);
});

test("only Vercel's client IP header determines deployed buckets", async () => {
  vi.stubEnv("VERCEL", "1");
  const auth = createAuth(await createTestDb(), mailbox);
  for (let i = 0; i < 3; i++) {
    expect(
      (
        await attempt(auth, "/sign-in/email", {
          "x-vercel-forwarded-for": "192.0.2.10",
          "x-forwarded-for": `198.51.100.${i}`,
        })
      ).status,
    ).toBe(400);
  }
  expect(
    (
      await attempt(auth, "/sign-in/email", {
        "x-vercel-forwarded-for": "192.0.2.10",
        "x-forwarded-for": "198.51.100.99",
      })
    ).status,
  ).toBe(429);
  expect(
    (
      await attempt(auth, "/sign-in/email", {
        "x-vercel-forwarded-for": "192.0.2.11",
        "x-forwarded-for": "198.51.100.99",
      })
    ).status,
  ).toBe(400);
});

test("E2E_TEST alone cannot disable limits outside the isolated local harness", async () => {
  vi.stubEnv("E2E_TEST", "1");
  const auth = createAuth(await createTestDb(), mailbox);
  for (let i = 0; i < 3; i++) await attempt(auth);
  expect((await attempt(auth)).status).toBe(429);
});

test("the isolated local harness can run ordinary browser journeys without throttling", async () => {
  vi.stubEnv("E2E_TEST", "1");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("E2E_SUPPORT_URL", "http://127.0.0.1:3101");
  const auth = createAuth(await createTestDb(), mailbox);
  for (let i = 0; i < 5; i++) expect((await attempt(auth)).status).toBe(400);
});

test("retry countdown expires without blocked attempts extending the window", async () => {
  const auth = createAuth(await createTestDb(), mailbox);
  let now = Date.now();
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  try {
    for (let i = 0; i < 3; i++) await attempt(auth);
    expect((await attempt(auth)).headers.get("x-retry-after")).toBe("10");
    now += 9_000;
    expect((await attempt(auth)).headers.get("x-retry-after")).toBe("1");
    now += 1_000;
    expect((await attempt(auth)).status).toBe(400);
  } finally {
    clock.mockRestore();
  }
});
