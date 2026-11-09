import { afterEach, expect, test, vi } from "vitest";
import { onRequestError } from "./instrumentation";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test.each([
  "render",
  "action",
  "route",
  "proxy",
] as const)("server %s failures emit bounded metadata without request or error content", (kind) => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a".repeat(40));
  vi.stubEnv(
    "VERCEL_DEPLOYMENT_ID",
    kind === "render" ? "dpl_144" : "private@example.com",
  );
  onRequestError(
    new Error("private notes token=secret"),
    {
      path: "/u/private?token=secret",
      method: "POST",
      headers: { authorization: "secret" },
    },
    {
      routerKind: "App Router",
      routePath: "/u/[username]",
      routeType: kind,
      renderSource: "react-server-components",
      revalidateReason: undefined,
    },
  );
  expect(log).toHaveBeenCalledOnce();
  const event = JSON.parse(log.mock.calls[0][0]);
  expect(event).toEqual({
    event: "operational_error",
    version: 1,
    operation: `server.${kind}`,
    code: "unexpected",
    deployment: kind === "render" ? "dpl_144" : "a".repeat(40),
    timestamp: expect.any(String),
    correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  });
  expect(JSON.stringify(event)).not.toMatch(
    /private|secret|authorization|username/,
  );
});

test("a logging failure cannot replace the original request failure", () => {
  vi.spyOn(console, "error").mockImplementation(() => {
    throw new Error("logging unavailable");
  });
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "private deployment value");
  expect(() =>
    onRequestError(
      new Error("original failure"),
      { path: "/", method: "GET", headers: {} },
      {
        routerKind: "App Router",
        routePath: "/",
        routeType: "route",
        revalidateReason: undefined,
      },
    ),
  ).not.toThrow();
});
