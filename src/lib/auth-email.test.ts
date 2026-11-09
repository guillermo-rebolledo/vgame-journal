import { inspect } from "node:util";
import { afterEach, expect, test, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { createAuth } from "./auth";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

afterEach(() => vi.restoreAllMocks());

test.each([
  "provider",
  "network",
])("%s mail failures stay redacted through Better Auth verification and reset handlers", async (failure) => {
  const logs = (["error", "warn", "log", "info", "debug"] as const).map(
    (method) => vi.spyOn(console, method).mockImplementation(() => {}),
  );
  const auth = createAuth(await createTestDb());
  const sentinel = "PRIVATE-auth-mail-sentinel";
  const email = "auth-recipient@example.com";
  const request = (path: string, body: object) =>
    auth.handler(
      new Request(`http://localhost:3000/api/auth/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify(body),
      }),
    );
  send.mockImplementation(async (message) => {
    const details = JSON.stringify({
      ...message,
      cookie: sentinel,
      authorization: sentinel,
    });
    if (failure === "network")
      throw new Error(details, { cause: new Error(sentinel) });
    return { error: { message: details, name: sentinel } };
  });

  for (const [path, body, status] of [
    ["sign-up/email", { name: "Player", email, password: "password123" }, 200],
    ["sign-in/email", { email, password: "password123" }, 403],
    ["send-verification-email", { email }, 500],
    ["request-password-reset", { email, redirectTo: "/reset-password" }, 200],
  ] as const) {
    send.mockClear();
    const response = await request(path, body);
    expect(response.status).toBe(status);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await response.text()).not.toContain(sentinel);
  }
  const output = inspect(
    logs.flatMap((log) => log.mock.calls),
    { depth: null, showHidden: true },
  );
  expect(output).toContain("Email delivery failed");
  expect(output).not.toContain(sentinel);
  expect(output).not.toContain(email);
  expect(output).not.toContain("token=");
  expect(output).not.toContain("Reset your password:");
  expect(output).not.toContain("Verify your email:");
});
