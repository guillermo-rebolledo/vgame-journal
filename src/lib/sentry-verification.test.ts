import { afterEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/internal/sentry-verification/route";
import { sentryVerificationAllowed } from "./sentry-verification";

const now = 1794520000000;
const token = `${now + 60_000}.${"a".repeat(64)}`;
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("only the exact unexpired owner capability permits verification", () => {
  expect(sentryVerificationAllowed(`Bearer ${token}`, token, now)).toBe(true);
  for (const auth of [
    null,
    "",
    token,
    `Bearer ${token}x`,
    `Bearer ${token.replace(/a$/, "b")}`,
    `Bearer ${token.replace(/a$/, "é")}`,
  ])
    expect(sentryVerificationAllowed(auth, token, now)).toBe(false);
  expect(
    sentryVerificationAllowed(`Bearer ${token}`, token, now + 60_000),
  ).toBe(false);
  expect(sentryVerificationAllowed(`Bearer ${token}`, "invalid", now)).toBe(
    false,
  );
});

test("disabled, expired and unauthorized probes cannot throw synthetic failures", async () => {
  vi.stubEnv("SENTRY_VERIFICATION_TOKEN", "");
  expect(
    (
      await POST(
        new Request("http://localhost/api/internal/sentry-verification", {
          method: "POST",
          headers: { "x-sentry-verification-kind": "route" },
        }),
      )
    ).status,
  ).toBe(404);
  vi.stubEnv(
    "SENTRY_VERIFICATION_TOKEN",
    `${Date.now() + 60_000}.${"a".repeat(64)}`,
  );
  expect(
    (
      await POST(
        new Request("http://localhost/api/internal/sentry-verification", {
          method: "POST",
          headers: {
            authorization: "Bearer wrong",
            "x-sentry-verification-kind": "route",
          },
        }),
      )
    ).status,
  ).toBe(404);
  vi.stubEnv(
    "SENTRY_VERIFICATION_TOKEN",
    `${Date.now() - 60_000}.${"a".repeat(64)}`,
  );
  expect(
    (
      await POST(
        new Request("http://localhost/api/internal/sentry-verification", {
          method: "POST",
          headers: {
            authorization: `Bearer ${process.env.SENTRY_VERIFICATION_TOKEN}`,
            "x-sentry-verification-kind": "route",
          },
        }),
      )
    ).status,
  ).toBe(404);
});

test("fixed route failure and caught fallback preserve their expected results", async () => {
  const active = `${Date.now() + 60_000}.${"a".repeat(64)}`;
  vi.stubEnv("SENTRY_VERIFICATION_TOKEN", active);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const request = (kind: string) =>
    new Request("http://localhost/api/internal/sentry-verification", {
      method: "POST",
      headers: {
        authorization: `Bearer ${active}`,
        "x-sentry-verification-kind": kind,
      },
    });
  await expect(POST(request("route"))).rejects.toThrow(
    "Sentry verification: route",
  );
  const result = await POST(request("caught"));
  expect(await result.json()).toEqual({ result: "Caught fallback preserved" });
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(log).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(log.mock.calls)).not.toContain(active);
  expect((await POST(request("arbitrary"))).status).toBe(400);
});
