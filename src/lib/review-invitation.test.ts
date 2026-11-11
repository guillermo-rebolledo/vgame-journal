import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { session, user } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { createReviewInvitation } from "./review-invitation";

test("viewing, session dismissal and account hiding stay isolated and reset for a new year", async () => {
  const db = await createTestDb();
  await db.insert(user).values(
    ["mario", "luigi"].map((id) => ({
      id,
      name: id,
      email: `${id}@example.com`,
    })),
  );
  await db.insert(session).values(
    [
      { id: "first", userId: "mario" },
      { id: "second", userId: "mario" },
      { id: "other", userId: "luigi" },
    ].map((item) => ({
      ...item,
      token: item.id,
      expiresAt: new Date("2030-01-01"),
      updatedAt: new Date(),
    })),
  );
  const notice = createReviewInvitation(db);
  expect(await notice.read("mario", "first")).toEqual({
    visible: true,
    viewed: false,
  });
  expect(await notice.read("mario", "other")).toEqual({
    visible: false,
    viewed: false,
  });
  expect(await notice.viewed("mario")).toBe(true);
  expect(await notice.viewed("mario")).toBe(false);
  await notice.dismiss("mario", "other");
  expect((await notice.read("luigi", "other")).visible).toBe(true);
  const [beforeDismiss] = await db
    .select()
    .from(session)
    .where(eq(session.id, "first"));
  await notice.dismiss("mario", "first");
  const [afterDismiss] = await db
    .select()
    .from(session)
    .where(eq(session.id, "first"));
  expect(afterDismiss.updatedAt).toEqual(beforeDismiss.updatedAt);
  expect(afterDismiss.expiresAt).toEqual(beforeDismiss.expiresAt);
  expect(await notice.read("mario", "first")).toEqual({
    visible: false,
    viewed: true,
  });
  expect(await notice.read("mario", "second")).toEqual({
    visible: true,
    viewed: true,
  });
  await notice.hide("mario");
  // A late visit marker cannot undo either dismissal.
  await notice.viewed("mario");
  expect((await notice.read("mario", "second")).visible).toBe(false);
  expect((await notice.read("luigi", "other")).visible).toBe(true);
  const nextYear = createReviewInvitation(db, 2027);
  expect(await nextYear.read("mario", "first")).toEqual({
    visible: true,
    viewed: false,
  });
  await nextYear.viewed("mario");
  await nextYear.hide("mario");
  await notice.hide("mario");
  await notice.viewed("mario");
  expect(await nextYear.read("mario", "second")).toEqual({
    visible: false,
    viewed: true,
  });
  await db.delete(user).where(eq(user.id, "mario"));
  expect((await notice.read("mario", "first")).visible).toBe(false);
});
