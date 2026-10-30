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
