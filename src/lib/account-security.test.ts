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
  const { session } = await import("@/db/schema");
  await db.insert(session).values({
    id: "session",
    userId: "owner",
    token: "token",
    expiresAt: new Date(Date.now() + 3600000),
    updatedAt: new Date(),
  });
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
  const { session } = await import("@/db/schema");
  await db.insert(session).values({
    id: "session",
    userId: "protected",
    token: "token",
    expiresAt: new Date(Date.now() + 3600000),
    updatedAt: new Date(),
  });
  await security.issue("protected", "session");
  await expect(
    createJournal(db).deleteAccount("protected", "DELETE", "session"),
  ).rejects.toThrow();
  expect(await security.ready("protected", "session")).toBe(true);
  expect((await createJournal(db).exportData("protected")).profile?.email).toBe(
    "protected@example.com",
  );
});

test("Google-only deletion requires a delivered email code in the initiating session before typed DELETE", async () => {
  const db = await createTestDb();
  const inbox: Email[] = [];
  const auth = createAuth(db, async (email) => {
    inbox.push(email);
  });
  await auth.api.signUpEmail({
    body: {
      name: "Player",
      email: "email-proof@example.com",
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
  if (!session) throw new Error("Expected session");
  const { account } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  await db.delete(account).where(eq(account.userId, session.user.id));
  await db.insert(account).values({
    id: "google-only",
    userId: session.user.id,
    providerId: "google",
    accountId: "google-only",
  });
  const security = createAccountSecurity(db);
  const send = async (email: Email) => {
    inbox.push(email);
  };
  await expect(
    security.sendCode(session.user.id, session.session.id, send),
  ).resolves.toEqual({ sent: true });
  expect(inbox.at(-1)?.to).toBe("email-proof@example.com");
  const code = inbox.at(-1)?.text.match(/\b\d{8}\b/)?.[0] ?? "";
  expect(code).toHaveLength(8);
  expect(await security.ready(session.user.id, session.session.id)).toBe(false);
  await expect(
    security.confirmCode(session.user.id, "other-session", code),
  ).resolves.toHaveProperty("error");
  await expect(
    security.confirmCode("other-account", session.session.id, code),
  ).resolves.toHaveProperty("error");
  await expect(
    security.confirmCode(session.user.id, session.session.id, code),
  ).resolves.toEqual({ verified: true });
  await expect(
    security.confirmCode(session.user.id, session.session.id, code),
  ).resolves.toHaveProperty("error");
  await expect(
    createJournal(db).deleteAccount(
      session.user.id,
      "wrong",
      session.session.id,
    ),
  ).rejects.toThrow(/Type DELETE/);
  await createJournal(db).deleteAccount(
    session.user.id,
    "DELETE",
    session.session.id,
  );
  expect(await auth.api.getSession({ headers })).toBeNull();
});

test.each([
  "failure",
  "attempts",
  "expiry",
  "cancel",
  "revoked",
  "unverified",
  "concurrent",
  "concurrent-cancel",
])("email deletion confirmation preserves safety on %s", async (scenario) => {
  const { account, session, user, verification } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = await createTestDb();
  await db.insert(user).values({
    id: "owner",
    name: "Owner",
    email: "verified@example.com",
    emailVerified: scenario !== "unverified",
  });
  await db.insert(account).values({
    id: "google",
    userId: "owner",
    providerId: "google",
    accountId: "google",
  });
  await db.insert(session).values({
    id: "session",
    userId: "owner",
    token: "session-token",
    expiresAt: new Date(Date.now() + 3600000),
    updatedAt: new Date(),
  });
  const security = createAccountSecurity(db);
  let code = "";
  const send = async (email: Email) => {
    code = email.text.match(/\b\d{8}\b/)?.[0] ?? "";
  };
  if (scenario === "failure") {
    await expect(
      security.sendCode("owner", "session", async (email) => {
        await send(email);
        throw new Error("PRIVATE-email-failure");
      }),
    ).resolves.toHaveProperty("error");
    await expect(
      security.confirmCode("owner", "session", code),
    ).resolves.toHaveProperty("error");
    expect(await security.ready("owner", "session")).toBe(false);
    await expect(security.sendCode("owner", "session", send)).resolves.toEqual({
      sent: true,
    });
    await expect(
      security.confirmCode("owner", "session", code),
    ).resolves.toEqual({ verified: true });
    return;
  }
  const sent = await security.sendCode("owner", "session", send);
  if (scenario === "unverified") {
    expect(sent).toHaveProperty("error");
    expect(code).toBe("");
  } else {
    expect(sent).toEqual({ sent: true });
    if (scenario === "attempts")
      for (let i = 0; i < 5; i++)
        await security.confirmCode("owner", "session", "incorrect");
    if (scenario === "expiry")
      await db
        .update(verification)
        .set({ expiresAt: new Date(0) })
        .where(eq(verification.id, "account-deletion-code:session"));
    if (scenario === "cancel") await security.cancel("session");
    if (scenario === "revoked")
      await db.delete(session).where(eq(session.id, "session"));
    if (scenario === "concurrent") {
      const results = await Promise.all([
        security.confirmCode("owner", "session", code),
        security.confirmCode("owner", "session", code),
      ]);
      expect(results.filter((result) => "verified" in result)).toHaveLength(1);
      return;
    }
    if (scenario === "concurrent-cancel") {
      await Promise.all([
        security.confirmCode("owner", "session", code),
        security.cancel("session"),
      ]);
      expect(await security.ready("owner", "session")).toBe(false);
    }
    await expect(
      security.confirmCode("owner", "session", code),
    ).resolves.toHaveProperty("error");
  }
  expect(await security.ready("owner", "session")).toBe(false);
  expect((await createJournal(db).exportData("owner")).profile?.email).toBe(
    "verified@example.com",
  );
});

test("email send budget survives cancellation and is shared across requests", async () => {
  const { session, user } = await import("@/db/schema");
  const db = await createTestDb();
  await db.insert(user).values({
    id: "owner",
    name: "Owner",
    email: "verified@example.com",
    emailVerified: true,
  });
  await db.insert(session).values({
    id: "session",
    userId: "owner",
    token: "token",
    expiresAt: new Date(Date.now() + 3600000),
    updatedAt: new Date(),
  });
  const security = createAccountSecurity(db);
  let sends = 0;
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      security.sendCode("owner", "session", async () => {
        sends++;
      }),
    ),
  );
  expect(results.filter((result) => "sent" in result)).toHaveLength(3);
  expect(sends).toBe(3);
  await security.cancel("session");
  await expect(
    security.sendCode("owner", "session", async () => {
      sends++;
    }),
  ).resolves.toHaveProperty("error");
  expect(sends).toBe(3);
});

test("revoking the initiating session also invalidates an already confirmed deletion proof", async () => {
  const { session, user } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = await createTestDb();
  await db.insert(user).values({
    id: "owner",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: true,
  });
  await db.insert(session).values({
    id: "session",
    userId: "owner",
    token: "token",
    expiresAt: new Date(Date.now() + 3600000),
    updatedAt: new Date(),
  });
  const security = createAccountSecurity(db);
  await security.issue("owner", "session");
  await db.delete(session).where(eq(session.id, "session"));
  expect(await security.ready("owner", "session")).toBe(false);
  await expect(
    createJournal(db).deleteAccount("owner", "DELETE", "session"),
  ).rejects.toThrow(/confirm your identity/i);
  expect((await createJournal(db).exportData("owner")).profile?.email).toBe(
    "owner@example.com",
  );
});
