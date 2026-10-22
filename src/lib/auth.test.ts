import { beforeEach, expect, test } from "vitest";
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
