import { expect, test } from "vitest";
import { createTestDb } from "@/test/db";
import { createAccountSecurity } from "./account-security";
import { createAuth, type Email } from "./auth";
import { createJournal } from "./journal";

test("deletion needs a fresh password proof for the same account and session", async () => {
  const db = await createTestDb();
  const inbox: Email[] = [];
  const auth = createAuth(db, async (email) => {
    inbox.push(email);
  });
  await auth.api.signUpEmail({
    body: {
      name: "Player",
      email: "delete@example.com",
      password: "password123",
    },
  });
  const token =
    new URL(inbox[0].text.match(/https?:\S+/)?.[0] ?? "").searchParams.get(
      "token",
    ) ?? "";
  const response = await auth.api.verifyEmail({
    query: { token },
    asResponse: true,
  });
  const headers = new Headers({
    cookie: response.headers.get("set-cookie") ?? "",
  });
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error("Expected verified session");
  const journal = createJournal(db);
  const security = createAccountSecurity(db);
  await expect(
    journal.deleteAccount(session.user.id, "DELETE", session.session.id),
  ).rejects.toThrow(/confirm your identity/i);
  await expect(
    auth.api.verifyPassword({ headers, body: { password: "wrong" } }),
  ).rejects.toThrow();
  expect(await auth.api.getSession({ headers })).not.toBeNull();
  await auth.api.verifyPassword({ headers, body: { password: "password123" } });
  await security.issue(session.user.id, session.session.id);
  await expect(
    journal.deleteAccount(session.user.id, "DELETE", "another-session"),
  ).rejects.toThrow();
  await expect(
    journal.deleteAccount("other-account", "DELETE", session.session.id),
  ).rejects.toThrow();
  await expect(
    journal.deleteAccount(session.user.id, "delete", session.session.id),
  ).rejects.toThrow(/Type DELETE/);
  await journal.deleteAccount(session.user.id, "DELETE", session.session.id);
  expect(await auth.api.getSession({ headers })).toBeNull();
  await expect(
    journal.deleteAccount(session.user.id, "DELETE", session.session.id),
  ).rejects.toThrow();
});

test("expired, cancelled and concurrent deletion attempts cannot spend the same proof", async () => {
  const db = await createTestDb();
  const { user } = await import("@/db/schema");
  await db
    .insert(user)
    .values({ id: "owner", name: "Owner", email: "owner@example.com" });
  const security = createAccountSecurity(db);
  const journal = createJournal(db);
  await security.issue("owner", "session", Date.now() - 300_001);
  await expect(
    journal.deleteAccount("owner", "DELETE", "session"),
  ).rejects.toThrow();
  await security.issue("owner", "session");
  await security.cancel("session");
  await expect(
    journal.deleteAccount("owner", "DELETE", "session"),
  ).rejects.toThrow();
  expect((await journal.exportData("owner")).profile?.email).toBe(
    "owner@example.com",
  );
  await security.issue("owner", "session");
  const attempts = await Promise.allSettled([
    journal.deleteAccount("owner", "DELETE", "session"),
    journal.deleteAccount("owner", "DELETE", "session"),
  ]);
  expect(
    attempts.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
});

test.each([
  "fresh",
  "missing",
  "stale",
  "mismatch",
  "forged",
  "cancelled",
])("Google deletion callback enforces %s provider authentication evidence (mock provider)", async (scenario) => {
  const { generateKeyPairSync, sign } = await import("node:crypto");
  const { vi } = await import("vitest");
  vi.stubEnv("E2E_TEST", "1");
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-google-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-google-secret");
  const db = await createTestDb();
  const inbox: Email[] = [];
  const auth = createAuth(db, async (email) => {
    inbox.push(email);
  });
  const { account } = await import("@/db/schema");
  await auth.api.signUpEmail({
    body: {
      name: "Player",
      email: "google-owner@example.com",
      password: "password123",
    },
  });
  const token =
    new URL(inbox[0].text.match(/https?:\S+/)?.[0] ?? "").searchParams.get(
      "token",
    ) ?? "";
  const verified = await auth.api.verifyEmail({
    query: { token },
    asResponse: true,
  });
  const cookie = verified.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  const original = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  if (!original) throw new Error("Expected session");
  await db.insert(account).values({
    id: "google-link",
    userId: original.user.id,
    accountId: "google-owner",
    providerId: "google",
  });
  const start = await auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/social", {
      method: "POST",
      headers: {
        cookie,
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: "google",
        callbackURL: "/settings?deletion=verified",
        errorCallbackURL: "/settings?deletion=failed",
        additionalParams: { prompt: "none" },
        additionalData: { deletionUserId: "forged" },
      }),
    }),
  );
  expect(start.status).toBe(200);
  const url = new URL((await start.json()).url);
  expect(url.searchParams.get("prompt")).toBe("login");
  expect(url.searchParams.get("max_age")).toBe("0");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid: "test-key",
    alg: "RS256",
    use: "sig",
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "https://accounts.google.com",
    aud: "test-google-client",
    sub: scenario === "mismatch" ? "other-google" : "google-owner",
    email:
      scenario === "mismatch"
        ? "other-google@example.com"
        : "google-owner@example.com",
    email_verified: true,
    name: "Player",
    iat: now,
    exp: now + 3600,
    nonce: url.searchParams.get("nonce"),
    ...(scenario === "missing"
      ? {}
      : { auth_time: scenario === "stale" ? now - 600 : now }),
  };
  const encoded = `${Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key" })).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  const jwt = `${encoded}.${sign("RSA-SHA256", Buffer.from(encoded), privateKey).toString("base64url")}`;
  const realFetch = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = input instanceof Request ? input.url : String(input);
      if (target === "https://oauth2.googleapis.com/token")
        return Response.json({
          access_token: "mock-access",
          token_type: "Bearer",
          expires_in: 3600,
          id_token:
            scenario === "forged" ? `${jwt.slice(0, -10)}aaaaaaaaaa` : jwt,
        });
      if (target.startsWith("https://www.googleapis.com/oauth2/v3/certs"))
        return Response.json({ keys: [jwk] });
      return realFetch(input, init);
    },
  );
  try {
    const callback = await auth.handler(
      new Request(
        `http://localhost:3000/api/auth/callback/google?${new URLSearchParams({ state: url.searchParams.get("state") ?? "", ...(scenario === "cancelled" ? { error: "access_denied" } : { code: "mock-code" }) })}`,
        {
          headers: {
            cookie: [
              cookie,
              ...start.headers
                .getSetCookie()
                .map((value) => value.split(";", 1)[0]),
            ].join("; "),
          },
        },
      ),
    );
    expect(callback.status).toBe(302);
    const nextHeaders = new Headers({
      cookie: callback.headers
        .getSetCookie()
        .map((value) => value.split(";", 1)[0])
        .join("; "),
    });
    const nextSession = await auth.api.getSession({ headers: nextHeaders });
    const security = createAccountSecurity(db);
    if (scenario === "fresh") {
      expect(nextSession?.user.id).toBe(original.user.id);
      expect(
        await security.ready(original.user.id, nextSession?.session.id ?? ""),
      ).toBe(true);
      await createJournal(db).deleteAccount(
        original.user.id,
        "DELETE",
        nextSession?.session.id,
      );
      expect(await auth.api.getSession({ headers: nextHeaders })).toBeNull();
    } else {
      expect(await security.ready(original.user.id, original.session.id)).toBe(
        false,
      );
      if (nextSession)
        expect(
          await security.ready(nextSession.user.id, nextSession.session.id),
        ).toBe(false);
      expect(
        (await createJournal(db).exportData(original.user.id)).profile?.email,
      ).toBe("google-owner@example.com");
    }
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

test("a database deletion failure rolls back proof consumption and preserves the account", async () => {
  const db = await createTestDb();
  const { user } = await import("@/db/schema");
  const { sql } = await import("drizzle-orm");
  await db.insert(user).values({
    id: "protected",
    name: "Player",
    email: "protected@example.com",
  });
  await db.execute(
    sql`create table deletion_failure (user_id text references "user"(id) on delete restrict)`,
  );
  await db.execute(sql`insert into deletion_failure values ('protected')`);
  const security = createAccountSecurity(db);
  await security.issue("protected", "session");
  await expect(
    createJournal(db).deleteAccount("protected", "DELETE", "session"),
  ).rejects.toThrow();
  expect(await security.ready("protected", "session")).toBe(true);
  expect((await createJournal(db).exportData("protected")).profile?.email).toBe(
    "protected@example.com",
  );
});
