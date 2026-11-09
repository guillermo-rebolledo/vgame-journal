import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Db } from "@/db";
import { feedback, user } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { createFeedback } from "./feedback";

let db: Db;
const author = { id: "mario", username: "mario", email: "mario@example.com" };
const input = {
  type: "bug",
  message: "  The shelf is empty  ",
  path: "/journal",
};
beforeEach(async () => {
  db = await createTestDb();
  await db.insert(user).values({ ...author, name: "Mario" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("only signed-in users with a username can submit", async () => {
  const submit = createFeedback(db, vi.fn());
  await expect(submit(null, input)).resolves.toEqual({
    error: "Sign in with a username to send feedback.",
  });
  await expect(
    submit({ ...author, username: null }, input),
  ).resolves.toHaveProperty("error");
});

test("stores the author's id, trimmed message, type and opening path before notifying the owner", async () => {
  vi.stubEnv("FEEDBACK_EMAIL", "delivered@resend.dev");
  const send = vi.fn(async () => {
    expect(await db.select().from(feedback)).toHaveLength(1);
  });
  await expect(
    createFeedback(db, send)(author, input),
  ).resolves.toBeUndefined();
  expect(await db.select().from(feedback)).toEqual([
    expect.objectContaining({
      userId: "mario",
      type: "bug",
      message: "The shelf is empty",
      path: "/journal",
      createdAt: expect.any(Date),
    }),
  ]);
  expect(send).toHaveBeenCalledWith({
    to: "delivered@resend.dev",
    replyTo: "mario@example.com",
    subject: "[Feedback: Bug] @mario",
    text: "Username: @mario\nType: Bug\nPath: /journal\n\nThe shelf is empty",
  });
});

test.each([
  { ...input, type: "feature" },
  { ...input, message: "   " },
  { ...input, message: "x".repeat(2001) },
  { ...input, message: null },
  { ...input, path: "https://example.com" },
  { ...input, path: "/journal?token=secret" },
  null,
])("rejects invalid feedback without storing or emailing it: %j", async (invalid) => {
  const send = vi.fn();
  await expect(
    createFeedback(db, send)(author, invalid as never),
  ).resolves.toHaveProperty("error");
  expect(await db.select().from(feedback)).toEqual([]);
  expect(send).not.toHaveBeenCalled();
});

test("accepts the 1 and 2000 character boundaries after trimming", async () => {
  const submit = createFeedback(db, vi.fn());
  await expect(
    submit(author, { ...input, message: " x " }),
  ).resolves.toBeUndefined();
  await expect(
    submit(author, { ...input, type: "other", message: "x".repeat(2000) }),
  ).resolves.toBeUndefined();
});

test("limits each user to five submissions in a rolling hour and permits the next after expiry", async () => {
  const submit = createFeedback(db, vi.fn());
  for (let i = 0; i < 5; i++)
    await expect(submit(author, input)).resolves.toBeUndefined();
  await expect(submit(author, input)).resolves.toEqual({
    error: "You’ve sent 5 messages in the past hour. Please try again later.",
  });
  await db
    .insert(user)
    .values({ id: "luigi", name: "Luigi", email: "luigi@example.com" });
  await expect(
    submit({ ...author, id: "luigi" }, input),
  ).resolves.toBeUndefined();
  await db
    .update(feedback)
    .set({ createdAt: sql`now() - interval '1 hour 1 second'` })
    .where(eq(feedback.userId, "mario"));
  await expect(submit(author, input)).resolves.toBeUndefined();
  expect(
    await db.select().from(feedback).where(eq(feedback.userId, "mario")),
  ).toHaveLength(6);
});

test("concurrent submissions cannot exceed five messages per user", async () => {
  vi.stubEnv("FEEDBACK_EMAIL", "delivered@resend.dev");
  const send = vi.fn();
  const submit = createFeedback(db, send);
  for (let i = 0; i < 4; i++) await submit(author, input);
  send.mockClear();

  const results = await Promise.all(
    Array.from({ length: 8 }, () => submit(author, input)),
  );
  expect(results.filter((result) => result === undefined)).toHaveLength(1);
  expect(results.filter((result) => result?.error)).toHaveLength(7);
  expect(send).toHaveBeenCalledTimes(1);
  await expect(submit(author, input)).resolves.toHaveProperty("error");
});

test("expiry frees only one slot for concurrent submissions while newer messages still count", async () => {
  const submit = createFeedback(db, vi.fn());
  for (let i = 0; i < 5; i++) await submit(author, input);
  await expect(submit(author, input)).resolves.toHaveProperty("error");

  const [oldest] = await db.select({ id: feedback.id }).from(feedback).limit(1);
  await db
    .update(feedback)
    .set({ createdAt: sql`now() - interval '1 hour 1 second'` })
    .where(eq(feedback.id, oldest.id));
  const results = await Promise.all(
    Array.from({ length: 3 }, () => submit(author, input)),
  );
  expect(results.filter((result) => result === undefined)).toHaveLength(1);
  expect(results.filter((result) => result?.error)).toHaveLength(2);
  await expect(submit(author, input)).resolves.toHaveProperty("error");
});

test("mail failure logs only a safe message and keeps one successful submission", async () => {
  vi.stubEnv("FEEDBACK_EMAIL", "delivered@resend.dev");
  const sentinel = "PRIVATE-feedback-recipient-token-cookie-authorization";
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const send = vi.fn(async () => {
    throw new Error(sentinel, { cause: new Error(sentinel) });
  });
  await expect(
    createFeedback(db, send)(author, { ...input, message: sentinel }),
  ).resolves.toBeUndefined();
  expect(await db.select().from(feedback)).toEqual([
    expect.objectContaining({ message: sentinel, userId: author.id }),
  ]);
  expect(send).toHaveBeenCalledTimes(1);
  expect(log.mock.calls).toEqual([["Feedback email failed"]]);
});

test("skips email with no recipient configured and cascades feedback on account deletion", async () => {
  vi.stubEnv("FEEDBACK_EMAIL", "");
  const send = vi.fn();
  await createFeedback(db, send)(author, input);
  expect(send).not.toHaveBeenCalled();
  expect(await db.select().from(feedback)).toHaveLength(1);
  await db.delete(user).where(eq(user.id, "mario"));
  expect(await db.select().from(feedback)).toEqual([]);
});
