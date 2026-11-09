import { beforeEach, expect, test, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { createAuth, type Email } from "./auth";

let auth: ReturnType<typeof createAuth>;
let inbox: Email[];

beforeEach(async () => {
  inbox = [];
  auth = createAuth(await createTestDb(), async (email) => {
    inbox.push(email);
  });
});

/** Signs up, follows the verification link, and returns signed-in request headers. */
async function signUpVerified(email: string) {
  await auth.api.signUpEmail({
    body: { name: "Player", email, password: "password123" },
  });
  const link = inbox.findLast((m) => m.to === email)?.text.match(/https?:\S+/);
  const token = new URL(link?.[0] ?? "").searchParams.get("token") ?? "";
  const res = await auth.api.verifyEmail({
    query: { token },
    asResponse: true,
  });
  const cookie = res.headers.get("set-cookie") ?? "";
  return new Headers({ cookie });
}

const chooseUsername = (headers: Headers, username: string) =>
  auth.api.updateUser({ headers, body: { username } });

async function usernameError(headers: Headers, username: string) {
  return chooseUsername(headers, username).then(
    () => null,
    (e: Error) => e.message,
  );
}

test("email sign-ups can't sign in until they verify", async () => {
  await auth.api.signUpEmail({
    body: { name: "Player", email: "a@example.com", password: "password123" },
  });

  await expect(
    auth.api.signInEmail({
      body: { email: "a@example.com", password: "password123" },
    }),
  ).rejects.toThrow(/not verified/i);
  expect(inbox[0].to).toBe("a@example.com");
});

test("a verified user starts without a username and can choose one", async () => {
  const headers = await signUpVerified("a@example.com");
  expect((await auth.api.getSession({ headers }))?.user.username).toBeNull();

  await chooseUsername(headers, "Mario_64");

  const session = await auth.api.getSession({ headers });
  expect(session?.user.username).toBe("mario_64");
});

test("a username can't be changed once chosen", async () => {
  const headers = await signUpVerified("a@example.com");
  await chooseUsername(headers, "mario");

  expect(await usernameError(headers, "wario")).toMatch(/cannot be updated/i);
});

test("usernames are unique regardless of case", async () => {
  await chooseUsername(await signUpVerified("a@example.com"), "Luigi");
  const other = await signUpVerified("b@example.com");

  expect(await usernameError(other, "LUIGI")).toMatch(/taken/i);
  expect(await usernameError(other, "luigi2")).toBeNull();
});

test.each([
  ["ab", /too short/i],
  ["a".repeat(31), /too long/i],
  ["has space", /invalid/i],
  ["has.dot", /invalid/i],
  ["emoji🎮", /invalid/i],
])("rejects username %j", async (username, error) => {
  const headers = await signUpVerified("a@example.com");
  expect(await usernameError(headers, username)).toMatch(error);
});

test.each([
  "/sign-in?returnTo=%2Fgames%2Fceleste",
  "/sign-in",
])("Google consent cancellation returns to %s and permits retry", async (errorCallbackURL) => {
  vi.stubEnv("E2E_TEST", "1");
  vi.stubEnv("GOOGLE_CLIENT_ID", "local-test-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "local-test-secret");
  try {
    const socialAuth = createAuth(await createTestDb(), async () => {});
    for (let attempt = 0; attempt < 2; attempt++) {
      const start = await socialAuth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/social", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            provider: "google",
            callbackURL: "/games/celeste",
            errorCallbackURL,
          }),
        }),
      );
      expect(start.status).toBe(200);
      const { url } = await start.json();
      const state = new URL(url).searchParams.get("state");
      expect(state).toBeTruthy();
      const cancelled = await socialAuth.handler(
        new Request(
          `http://localhost:3000/api/auth/callback/google?${new URLSearchParams(
            {
              state: state ?? "",
              error: "access_denied",
            },
          )}`,
          {
            headers: {
              cookie: start.headers
                .getSetCookie()
                .map((cookie) => cookie.split(";", 1)[0])
                .join("; "),
            },
          },
        ),
      );
      expect(cancelled.status).toBe(302);
      const destination = new URL(
        cancelled.headers.get("location") ?? "",
        "http://localhost:3000",
      );
      expect(destination.origin).toBe("http://localhost:3000");
      expect(destination.pathname).toBe("/sign-in");
      expect(destination.searchParams.get("returnTo")).toBe(
        errorCallbackURL === "/sign-in" ? null : "/games/celeste",
      );
      expect(destination.searchParams.get("error")).toBe("access_denied");
    }
  } finally {
    vi.unstubAllEnvs();
  }
});

test("account email failures emit a safe event and do not expose the provider error", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const failing = createAuth(await createTestDb(), async () => {
      throw new Error("private@example.com token=secret");
    });
    const response = await failing.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Player",
          email: "private@example.com",
          password: "password123",
        }),
      }),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"operation":"account_email.verification"'),
    );
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /private@example|token=secret/,
    );
    expect(await response.text()).not.toContain("token=secret");
  } finally {
    log.mockRestore();
  }
});

test("password-reset delivery failure emits an operator event while the response stays generic", async () => {
  let fail = false;
  const failing = createAuth(await createTestDb(), async () => {
    if (fail) throw new Error("private recipient and token");
  });
  await failing.api.signUpEmail({
    body: {
      name: "Player",
      email: "reset@example.com",
      password: "password123",
    },
  });
  fail = true;
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await failing.handler(
      new Request("http://localhost:3000/api/auth/request-password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "reset@example.com",
          redirectTo: "http://localhost:3000/reset-password",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"operation":"account_email.password_reset"'),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      "private recipient and token",
    );
    expect(await response.text()).not.toContain("private recipient and token");
  } finally {
    log.mockRestore();
  }
});

test("sign out all devices revokes current and independently signed-in sessions", async () => {
  const first = await signUpVerified("sessions@example.com");
  const response = await auth.api.signInEmail({
    body: { email: "sessions@example.com", password: "password123" },
    asResponse: true,
  });
  const second = new Headers({
    cookie: response.headers.get("set-cookie") ?? "",
  });
  expect(await auth.api.getSession({ headers: second })).not.toBeNull();
  await auth.api.revokeSessions({ headers: first });
  expect(await auth.api.getSession({ headers: first })).toBeNull();
  expect(await auth.api.getSession({ headers: second })).toBeNull();
});

test("password reset revokes every existing session and requires the new password", async () => {
  const first = await signUpVerified("reset-sessions@example.com");
  const response = await auth.api.signInEmail({
    body: { email: "reset-sessions@example.com", password: "password123" },
    asResponse: true,
  });
  const second = new Headers({
    cookie: response.headers.get("set-cookie") ?? "",
  });
  await auth.api.requestPasswordReset({
    body: { email: "reset-sessions@example.com" },
  });
  const url = new URL(inbox.at(-1)?.text.match(/https?:\S+/)?.[0] ?? "");
  const token = url.pathname.split("/").at(-1) ?? "";
  await auth.api.resetPassword({
    body: { token, newPassword: "replacement123" },
  });
  expect(await auth.api.getSession({ headers: first })).toBeNull();
  expect(await auth.api.getSession({ headers: second })).toBeNull();
  await expect(
    auth.api.signInEmail({
      body: { email: "reset-sessions@example.com", password: "password123" },
    }),
  ).rejects.toThrow();
  expect(
    (
      await auth.api.signInEmail({
        body: {
          email: "reset-sessions@example.com",
          password: "replacement123",
        },
      })
    ).user.email,
  ).toBe("reset-sessions@example.com");
});
