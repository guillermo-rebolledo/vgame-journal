import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Db } from "@/db";
import { game, user } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { createJournal } from "./journal";

let db: Db;
let journal: ReturnType<typeof createJournal>;

beforeEach(async () => {
  db = await createTestDb();
  journal = createJournal(db);
  await db.insert(user).values(
    ["mario", "luigi"].map((id) => ({
      id,
      name: id,
      email: `${id}@example.com`,
    })),
  );
  await db.insert(game).values(
    [1, 2].map((id) => ({
      id,
      title: `Game ${id}`,
      slug: `game-${id}`,
      genres: [],
      platforms: [],
      syncedAt: new Date(),
    })),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

test("a game added with a status is in the journal", async () => {
  await journal.set("mario", 1, { status: "backlog" });

  expect(await journal.entry("mario", 1)).toMatchObject({
    status: "backlog",
    completionTag: null,
  });
  expect(await journal.entry("mario", 2)).toBeNull();
});

test("a completion tag is only allowed when the game is played", async () => {
  await journal.set("mario", 1, {
    status: "played",
    completionTag: "completed",
  });
  expect(await journal.entry("mario", 1)).toMatchObject({
    status: "played",
    completionTag: "completed",
  });

  await expect(
    journal.set("mario", 2, { status: "wishlist", completionTag: "shelved" }),
  ).rejects.toThrow(/only played games/i);
  expect(await journal.entry("mario", 2)).toBeNull();
});

test("moving a played game to another status drops its tag", async () => {
  await journal.set("mario", 1, { status: "played", completionTag: "retired" });
  await journal.set("mario", 1, { status: "playing" });

  expect(await journal.entry("mario", 1)).toMatchObject({
    status: "playing",
    completionTag: null,
  });
});

test("unknown statuses and tags are rejected", async () => {
  await expect(
    // @ts-expect-error: form input is untrusted
    journal.set("mario", 1, { status: "beaten" }),
  ).rejects.toThrow(/status/i);
  await expect(
    // @ts-expect-error: form input is untrusted
    journal.set("mario", 1, { status: "played", completionTag: "100%" }),
  ).rejects.toThrow(/tag/i);
});

test("a removed game leaves the journal", async () => {
  await journal.set("mario", 1, { status: "backlog" });
  await journal.remove("mario", 1);

  expect(await journal.entry("mario", 1)).toBeNull();
});

test("every status change is recorded with its time, including add and remove", async () => {
  vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
  await journal.set("mario", 1, { status: "backlog" });
  vi.setSystemTime(new Date("2026-01-05T10:00:00Z"));
  await journal.set("mario", 1, { status: "playing" });
  await journal.set("mario", 1, { status: "playing" }); // no change, no event
  vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
  await journal.set("mario", 1, {
    status: "played",
    completionTag: "completed",
  });
  vi.setSystemTime(new Date("2026-03-01T10:00:00Z"));
  await journal.remove("mario", 1);
  await journal.remove("mario", 1); // already gone, no event

  expect(await journal.statusEvents("mario")).toEqual([
    {
      gameId: 1,
      status: "backlog",
      completionTag: null,
      at: new Date("2026-01-01T10:00:00Z"),
    },
    {
      gameId: 1,
      status: "playing",
      completionTag: null,
      at: new Date("2026-01-05T10:00:00Z"),
    },
    {
      gameId: 1,
      status: "played",
      completionTag: "completed",
      at: new Date("2026-02-01T10:00:00Z"),
    },
    {
      gameId: 1,
      status: null,
      completionTag: null,
      at: new Date("2026-03-01T10:00:00Z"),
    },
  ]);
});

test("a user's writes never touch another user's entries", async () => {
  await journal.set("mario", 1, {
    status: "played",
    completionTag: "completed",
  });

  await journal.set("luigi", 1, { status: "wishlist" });
  await journal.remove("luigi", 1);

  expect(await journal.entry("mario", 1)).toMatchObject({
    status: "played",
    completionTag: "completed",
  });
  expect(await journal.entry("luigi", 1)).toBeNull();
  expect(await journal.statusEvents("mario")).toHaveLength(1);
});
