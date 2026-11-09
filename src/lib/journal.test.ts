import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Db } from "@/db";
import {
  account,
  game,
  journalEntry,
  playthrough,
  releaseDate,
  session,
  statusEvent,
  user,
  verification,
} from "@/db/schema";
import type { RatingPoints } from "@/lib/rating";
import { createTestDb } from "@/test/db";
import { createJournal, JournalError } from "./journal";

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
      platforms: ["PlayStation 4", "PlayStation 5"],
      syncedAt: new Date(),
    })),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

test("export includes the owner's profile, entries, full history and private playthrough notes", async () => {
  await journal.set("mario", 1, { status: "backlog" });
  await journal.set("mario", 1, {
    status: "played",
    completionTag: "completed",
  });
  await journal.addPlaythrough("mario", 1, {
    platform: "PlayStation 5",
    startedOn: "2026-01-01",
    endedOn: "2026-01-10",
    hours: 12.25,
    notes: "My private notes",
  });
  await journal.set("mario", 2, { status: "wishlist" });
  await journal.remove("mario", 2);
  await journal.set("luigi", 2, { status: "playing" });
  await journal.addPlaythrough("luigi", 2, {
    platform: "PlayStation 4",
    startedOn: "2026-02-01",
    notes: "Someone else's notes",
  });
  await journal.feedToken("mario");

  const exported = JSON.parse(
    JSON.stringify(await journal.exportData("mario")),
  );
  expect(exported.profile).toMatchObject({
    id: "mario",
    name: "mario",
    email: "mario@example.com",
    region: "earliest",
  });
  expect(exported.entries).toEqual([
    expect.objectContaining({
      gameId: 1,
      title: "Game 1",
      slug: "game-1",
      status: "played",
      completionTag: "completed",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    }),
  ]);
  expect(
    exported.statusHistory.map(
      (event: { gameId: number; status: string | null }) => [
        event.gameId,
        event.status,
      ],
    ),
  ).toEqual([
    [1, "backlog"],
    [1, "played"],
    [2, "wishlist"],
    [2, null],
  ]);
  expect(exported.statusHistory[1]).toMatchObject({
    completionTag: "completed",
    at: expect.any(String),
  });
  expect(exported.playthroughs).toEqual([
    expect.objectContaining({
      gameId: 1,
      platform: "PlayStation 5",
      startedOn: "2026-01-01",
      endedOn: "2026-01-10",
      hours: 12.25,
      notes: "My private notes",
    }),
  ]);
  expect(JSON.stringify(exported)).not.toMatch(
    /luigi|Someone else's|feedToken|password|accessToken/,
  );
  await expect(journal.exportData("unknown")).rejects.toThrow(
    /user not found/i,
  );
});

test("account deletion requires typed confirmation and cascades only the owner's data", async () => {
  for (const owner of ["mario", "luigi"]) {
    await db.insert(verification).values({
      id: `${owner}-reset`,
      identifier: `reset-password:${owner}-token`,
      value: owner,
      expiresAt: new Date("2030-01-01"),
    });
    await db.insert(session).values(
      [1, 2].map((id) => ({
        id: `${owner}-${id}`,
        token: `${owner}-token-${id}`,
        userId: owner,
        expiresAt: new Date("2030-01-01"),
        updatedAt: new Date(),
      })),
    );
    await db.insert(account).values({
      id: owner,
      accountId: owner,
      providerId: "credential",
      userId: owner,
      password: "hash",
      updatedAt: new Date(),
    });
    await journal.set(owner, 1, { status: "playing" });
    await journal.addPlaythrough(owner, 1, {
      platform: "PlayStation 5",
      startedOn: "2026-01-01",
      notes: `${owner}'s notes`,
    });
    await journal.set(owner, 2, { status: "wishlist" });
    await journal.remove(owner, 2);
    await journal.feedToken(owner);
  }
  const token = await journal.feedToken("mario");
  const survivor = await journal.exportData("luigi");

  for (const confirmation of [null, "", "delete", "DELETE ", "luigi"])
    await expect(journal.deleteAccount("mario", confirmation)).rejects.toThrow(
      /Type DELETE/,
    );
  expect((await journal.exportData("mario")).playthroughs).toHaveLength(1);

  await journal.deleteAccount("mario", "DELETE");

  for (const [table, ownerColumn] of [
    [user, user.id],
    [session, session.userId],
    [account, account.userId],
    [journalEntry, journalEntry.userId],
    [statusEvent, statusEvent.userId],
    [playthrough, playthrough.userId],
  ] as const) {
    expect(
      await db.select().from(table).where(eq(ownerColumn, "mario")),
    ).toEqual([]);
  }
  expect(await journal.calendarFeed(token)).toBeNull();
  expect(
    await db.select().from(verification).where(eq(verification.value, "mario")),
  ).toEqual([]);
  expect(
    await db.select().from(verification).where(eq(verification.value, "luigi")),
  ).toHaveLength(1);
  expect(await journal.exportData("luigi")).toEqual(survivor);
  expect(
    await db.select().from(session).where(eq(session.userId, "luigi")),
  ).toHaveLength(2);
  expect(
    await db.select().from(account).where(eq(account.userId, "luigi")),
  ).toHaveLength(1);
  expect((await db.select().from(game)).map((g) => g.id).sort()).toEqual([
    1, 2,
  ]);
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
  await expect(
    journal.set("mario", 1, { status: "backlog", completionTag: "completed" }),
  ).rejects.toBeInstanceOf(JournalError);
});

test("a removed game leaves the journal", async () => {
  await journal.set("mario", 1, { status: "backlog" });
  await journal.remove("mario", 1);

  expect(await journal.entry("mario", 1)).toBeNull();
});

test("removing saved Playthroughs requires explicit acknowledgement at the owner boundary", async () => {
  for (const owner of ["mario", "luigi"]) {
    await journal.set(owner, 1, {
      status: "played",
      completionTag: "completed",
    });
    await journal.addPlaythrough(owner, 1, {
      platform: "PlayStation 5",
      startedOn: "2026-01-02",
      notes: `${owner}'s private note`,
    });
  }
  const before = await journal.exportData("mario");
  const otherOwner = await journal.exportData("luigi");
  for (const acknowledgement of [undefined, false, "true", 1]) {
    await expect(journal.remove("mario", 1, acknowledgement)).resolves.toEqual({
      confirmationRequired: true,
      playthroughCount: 1,
      rated: false,
    });
    expect(await journal.exportData("mario")).toEqual(before);
  }

  await journal.remove("mario", 1, true);
  expect(await journal.entry("mario", 1)).toBeNull();
  expect(await journal.playthroughs("mario", 1)).toEqual([]);
  expect(await journal.statusEvents("mario")).toEqual([
    ...before.statusHistory.map(({ gameId, status, completionTag, at }) => ({
      gameId,
      status,
      completionTag,
      at,
    })),
    { gameId: 1, status: null, completionTag: null, at: expect.any(Date) },
  ]);
  expect(await journal.exportData("luigi")).toEqual(otherOwner);
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

test("a move happens only from the expected status, and undo only if nothing changed since", async () => {
  await journal.set("mario", 1, { status: "wishlist" });
  await journal.set("luigi", 1, { status: "wishlist" });

  const moved = await journal.move(
    "mario",
    1,
    { status: "wishlist" },
    "backlog",
  );
  expect(moved).toBeInstanceOf(Date);
  expect(await journal.entry("mario", 1)).toMatchObject({ status: "backlog" });
  expect(await journal.entry("luigi", 1)).toMatchObject({ status: "wishlist" });
  // A second click, or another tab, finds it already moved.
  expect(
    await journal.move("mario", 1, { status: "wishlist" }, "playing"),
  ).toBeNull();

  // Undo succeeds while the entry is exactly as the move left it.
  const undo = { status: "backlog" as const, updatedAt: moved ?? undefined };
  expect(await journal.move("mario", 1, undo, "wishlist")).toBeInstanceOf(Date);
  expect(await journal.entry("mario", 1)).toMatchObject({ status: "wishlist" });

  // A later change, even one that lands on the same status, blocks undo.
  const again = await journal.move(
    "mario",
    1,
    { status: "wishlist" },
    "backlog",
  );
  await journal.set("mario", 1, { status: "playing" });
  await journal.set("mario", 1, { status: "backlog" });
  expect(
    await journal.move(
      "mario",
      1,
      { status: "backlog", updatedAt: again ?? undefined },
      "wishlist",
    ),
  ).toBeNull();
  expect(await journal.entry("mario", 1)).toMatchObject({ status: "backlog" });

  // Nobody moves another user's entry, and moves are recorded like any change.
  expect(
    await journal.move("mario", 2, { status: "wishlist" }, "backlog"),
  ).toBeNull();
  expect((await journal.statusEvents("mario")).map((e) => e.status)).toEqual([
    "wishlist",
    "backlog",
    "wishlist",
    "backlog",
    "playing",
    "backlog",
  ]);
  await expect(
    journal.move("mario", 1, { status: "backlog" }, "nope" as "backlog"),
  ).rejects.toThrow(JournalError);
});

test("a playthrough logged on a journal entry is listed with its details", async () => {
  await journal.set("mario", 1, { status: "playing" });
  await journal.addPlaythrough("mario", 1, {
    platform: "PlayStation 5",
    startedOn: "2026-01-02",
    endedOn: "2026-02-03",
    hours: 41.5,
    notes: "Took the long way round.",
  });

  expect(await journal.playthroughs("mario", 1)).toMatchObject([
    {
      platform: "PlayStation 5",
      startedOn: "2026-01-02",
      endedOn: "2026-02-03",
      hours: 41.5,
      notes: "Took the long way round.",
    },
  ]);
});

test("a playthrough needs the game in the journal, and leaves with it", async () => {
  const run = { platform: "PlayStation 5", startedOn: "2026-01-02" };
  await expect(journal.addPlaythrough("mario", 1, run)).rejects.toThrow(
    /not in your journal/i,
  );

  await journal.set("mario", 1, { status: "playing" });
  await journal.addPlaythrough("mario", 1, run);
  await journal.remove("mario", 1, true);
  await journal.set("mario", 1, { status: "playing" });

  expect(await journal.playthroughs("mario", 1)).toEqual([]);
});

test("a playthrough can't end before it starts, and needs real dates and hours", async () => {
  await journal.set("mario", 1, { status: "played" });
  const run = { platform: "PlayStation 5", startedOn: "2026-03-10" };

  await expect(
    journal.addPlaythrough("mario", 1, { ...run, endedOn: "2026-03-09" }),
  ).rejects.toThrow(/end.*before.*start/i);
  for (const startedOn of ["2026-02-30", "2026-13-01", "2026-02-32"])
    await expect(
      journal.addPlaythrough("mario", 1, { ...run, startedOn }),
    ).rejects.toThrow(/real days/i);
  await expect(
    journal.addPlaythrough("mario", 1, { ...run, hours: -1 }),
  ).rejects.toThrow(/hours/i);
  expect(await journal.playthroughs("mario", 1)).toEqual([]);

  await journal.addPlaythrough("mario", 1, { ...run, endedOn: "2026-03-10" });
  expect(await journal.playthroughs("mario", 1)).toHaveLength(1);
});

test("playthroughs are listed oldest first, whatever order they were logged in", async () => {
  await journal.set("mario", 1, { status: "played" });
  for (const startedOn of ["2025-06-01", "2019-03-15", "2022-11-20"])
    await journal.addPlaythrough("mario", 1, {
      platform: "PlayStation 4",
      startedOn,
    });

  const runs = await journal.playthroughs("mario", 1);
  expect(runs.map((r) => r.startedOn)).toEqual([
    "2019-03-15",
    "2022-11-20",
    "2025-06-01",
  ]);
});

test("a playthrough can be edited and deleted", async () => {
  await journal.set("mario", 1, { status: "playing" });
  await journal.addPlaythrough("mario", 1, {
    platform: "PlayStation 4",
    startedOn: "2026-01-02",
    hours: 3,
  });
  const [run] = await journal.playthroughs("mario", 1);

  await journal.updatePlaythrough("mario", run.id, {
    platform: "PlayStation 5",
    startedOn: "2026-01-01",
    endedOn: "2026-01-20",
    hours: 12.25,
    notes: "Finally beat it.",
  });
  expect(await journal.playthroughs("mario", 1)).toMatchObject([
    {
      id: run.id,
      platform: "PlayStation 5",
      startedOn: "2026-01-01",
      endedOn: "2026-01-20",
      hours: 12.25,
      notes: "Finally beat it.",
    },
  ]);

  await expect(
    journal.updatePlaythrough("mario", run.id, {
      platform: "PlayStation 5",
      startedOn: "2026-01-21",
      endedOn: "2026-01-20",
    }),
  ).rejects.toThrow(/end.*before.*start/i);

  await journal.removePlaythrough("mario", run.id);
  expect(await journal.playthroughs("mario", 1)).toEqual([]);
});

test("a user's playthrough writes never touch another user's playthroughs", async () => {
  await journal.set("mario", 1, { status: "played" });
  await journal.addPlaythrough("mario", 1, {
    platform: "PlayStation 4",
    startedOn: "2026-01-02",
    notes: "Mine.",
  });
  const [run] = await journal.playthroughs("mario", 1);
  await journal.set("luigi", 1, { status: "played" });

  await journal.updatePlaythrough("luigi", run.id, {
    platform: "PlayStation 5",
    startedOn: "2026-05-05",
    notes: "Stolen.",
  });
  await journal.removePlaythrough("luigi", run.id);

  expect(await journal.playthroughs("mario", 1)).toMatchObject([
    { platform: "PlayStation 4", startedOn: "2026-01-02", notes: "Mine." },
  ]);
  expect(await journal.playthroughs("luigi", 1)).toEqual([]);
});

test("a playthrough's platform is one of the game's platforms", async () => {
  await journal.set("mario", 1, { status: "played" });

  await expect(
    journal.addPlaythrough("mario", 1, {
      platform: "Xbox Series X|S",
      startedOn: "2026-03-10",
    }),
  ).rejects.toThrow(/platform/i);
  expect(await journal.playthroughs("mario", 1)).toEqual([]);
});

test("the library lists the user's games, most recently added first", async () => {
  vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
  await journal.set("mario", 1, { status: "backlog" });
  vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
  await journal.set("mario", 2, { status: "wishlist" });
  vi.setSystemTime(new Date("2026-03-01T10:00:00Z"));
  await journal.set("mario", 1, { status: "playing" }); // a change isn't an add
  await journal.set("luigi", 1, { status: "played" });

  expect(await journal.library("mario")).toMatchObject([
    {
      gameId: 2,
      title: "Game 2",
      slug: "game-2",
      status: "wishlist",
      addedAt: new Date("2026-02-01T10:00:00Z"),
    },
    {
      gameId: 1,
      status: "playing",
      addedAt: new Date("2026-01-01T10:00:00Z"),
    },
  ]);
  expect(await journal.library("peach")).toEqual([]);
});

test("the library filters by status, playthrough platform and year played, combined", async () => {
  await db.insert(game).values({
    id: 3,
    title: "Game 3",
    slug: "game-3",
    genres: [],
    platforms: ["PlayStation 5"],
    syncedAt: new Date(),
  });
  vi.setSystemTime(new Date("2026-06-01T10:00:00Z"));
  await journal.set("mario", 1, { status: "played" });
  await journal.set("mario", 2, { status: "played" });
  await journal.set("mario", 3, { status: "playing" });
  await journal.addPlaythrough("mario", 1, {
    platform: "PlayStation 4",
    startedOn: "2022-11-20",
    endedOn: "2023-01-10", // spans two years
  });
  await journal.addPlaythrough("mario", 2, {
    platform: "PlayStation 5",
    startedOn: "2024-03-01",
    endedOn: "2024-04-01",
  });
  await journal.addPlaythrough("mario", 3, {
    platform: "PlayStation 5",
    startedOn: "2025-12-01", // ongoing, so still being played this year
  });
  await journal
    .addPlaythrough("luigi", 1, {
      platform: "PlayStation 5",
      startedOn: "2021-01-01",
    })
    .catch(() => {}); // not in luigi's journal

  const ids = async (filters: Parameters<typeof journal.library>[1]) =>
    (await journal.library("mario", filters)).map((e) => e.gameId).sort();

  expect(await ids({ status: "played" })).toEqual([1, 2]);
  expect(await ids({ platform: "PlayStation 5" })).toEqual([2, 3]);
  expect(await ids({ year: 2022 })).toEqual([1]);
  expect(await ids({ year: 2023 })).toEqual([1]);
  expect(await ids({ year: 2026 })).toEqual([3]);
  expect(await ids({ year: 2021 })).toEqual([]);
  expect(await ids({ status: "played", platform: "PlayStation 5" })).toEqual([
    2,
  ]);
  expect(await ids({ platform: "PlayStation 4", year: 2024 })).toEqual([]);
  expect(await ids({})).toEqual([1, 2, 3]);
});

test("the library sorts by date added, release date or title", async () => {
  await db.insert(game).values({
    id: 3,
    title: "another game",
    slug: "another-game",
    genres: [],
    platforms: [],
    syncedAt: new Date(),
  });
  await db.insert(releaseDate).values([
    // Game 1's earliest release counts; a TBD one is ignored.
    {
      gameId: 1,
      region: "europe",
      date: new Date("2020-05-01"),
      precision: "day",
    },
    {
      gameId: 1,
      region: "japan",
      date: new Date("2019-03-01"),
      precision: "day",
    },
    {
      gameId: 2,
      region: "europe",
      date: new Date("2018-01-01"),
      precision: "tbd",
    },
    {
      gameId: 2,
      region: "japan",
      date: new Date("2023-01-01"),
      precision: "year",
    },
  ]);
  vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
  await journal.set("mario", 2, { status: "backlog" });
  vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
  await journal.set("mario", 3, { status: "backlog" });
  vi.setSystemTime(new Date("2026-03-01T10:00:00Z"));
  await journal.set("mario", 1, { status: "backlog" });

  const order = async (sort: Parameters<typeof journal.library>[2]) =>
    (await journal.library("mario", {}, sort)).map((e) => e.title);

  expect(await order("added")).toEqual(["Game 1", "another game", "Game 2"]);
  expect(await order("released")).toEqual(["Game 2", "Game 1", "another game"]);
  expect(await order("title")).toEqual(["another game", "Game 1", "Game 2"]);
  expect((await journal.library("mario")).map((e) => e.releasedAt)).toEqual([
    new Date("2019-03-01"),
    null,
    new Date("2023-01-01"),
  ]);
});

test("the wishlist lists only wishlisted games, with releases in the user's region, soonest first", async () => {
  await db.insert(game).values({
    id: 3,
    title: "Game 3",
    slug: "game-3",
    genres: [],
    platforms: [],
    syncedAt: new Date(),
  });
  await db.insert(releaseDate).values([
    {
      gameId: 1,
      region: "japan",
      date: new Date("2026-11-05T00:00:00Z"),
      precision: "day",
    },
    {
      gameId: 1,
      region: "europe",
      date: new Date("2026-12-10T00:00:00Z"),
      precision: "day",
    },
    {
      gameId: 2,
      region: "worldwide",
      date: new Date("2026-12-01T00:00:00Z"),
      precision: "day",
    },
    {
      gameId: 3,
      region: "worldwide",
      date: new Date("2026-09-30T00:00:00Z"),
      precision: "quarter",
    },
  ]);
  for (const id of [1, 2, 3])
    await journal.set("mario", id, { status: "wishlist" });
  await journal.set("luigi", 1, { status: "backlog" });

  const read = async () =>
    (await journal.wishlist("mario")).map((e) => [e.title, e.release.label]);

  expect(await read()).toEqual([
    ["Game 1", "Nov 5, 2026"],
    ["Game 2", "Dec 1, 2026"],
    ["Game 3", "Q3 2026"],
  ]);
  expect(await journal.wishlist("luigi")).toEqual([]);

  await journal.setRegion("mario", "europe");
  expect(await read()).toEqual([
    ["Game 2", "Dec 1, 2026"],
    ["Game 1", "Dec 10, 2026"],
    ["Game 3", "Q3 2026"],
  ]);
});

test("the region is earliest until the user picks another one, and only known regions are accepted", async () => {
  expect(await journal.region("mario")).toBe("earliest");

  await journal.setRegion("mario", "japan");
  expect(await journal.region("mario")).toBe("japan");
  expect(await journal.region("luigi")).toBe("earliest");

  await expect(
    // @ts-expect-error: form input is untrusted
    journal.setRegion("mario", "mars"),
  ).rejects.toThrow(/region/i);
  expect(await journal.region("mario")).toBe("japan");
});

test("simultaneous first settings visits receive the same working calendar feed token", async () => {
  const tokens = await Promise.all([
    journal.feedToken("mario"),
    journal.feedToken("mario"),
  ]);

  expect(tokens[1]).toBe(tokens[0]);
  expect(await journal.feedToken("mario")).toBe(tokens[0]);
  for (const token of tokens)
    expect(await journal.calendarFeed(token)).toContain("BEGIN:VCALENDAR");
});

test("a user's feed token stays the same until regenerated, which stops the old one working", async () => {
  await journal.set("mario", 1, { status: "wishlist" });
  const token = await journal.feedToken("mario");
  expect(token).toMatch(/^[\w-]{32,}$/);
  expect(await journal.feedToken("mario")).toBe(token);
  expect(await journal.feedToken("luigi")).not.toBe(token);
  expect(await journal.calendarFeed(token)).toContain("BEGIN:VCALENDAR");

  const fresh = await journal.regenerateFeedToken("mario");
  expect(fresh).not.toBe(token);
  expect(await journal.feedToken("mario")).toBe(fresh);
  expect(await journal.calendarFeed(token)).toBeNull();
  expect(await journal.calendarFeed(fresh)).toContain("BEGIN:VCALENDAR");
  expect(await journal.calendarFeed("")).toBeNull();
});

test("the calendar feed has an all-day event per wishlisted game with an exact date in the user's region", async () => {
  await db.insert(game).values(
    [
      [
        3,
        "Hollow Knight: Silksong, Deluxe; Edition — Collector’s Bündle für alle",
      ],
      [4, "Vague Game"],
      [5, "TBA Game"],
    ].map(([id, title]) => ({
      id: id as number,
      title: title as string,
      slug: `game-${id}`,
      genres: [],
      platforms: [],
      syncedAt: new Date(),
    })),
  );
  await db.insert(releaseDate).values([
    {
      gameId: 1,
      region: "japan",
      date: new Date("2026-11-05"),
      precision: "day",
    },
    {
      gameId: 1,
      region: "europe",
      date: new Date("2026-12-31"),
      precision: "day",
    },
    {
      gameId: 2,
      region: "worldwide",
      date: new Date("2027-03-01"),
      precision: "day",
    },
    {
      gameId: 3,
      region: "worldwide",
      date: new Date("2026-12-01"),
      precision: "day",
    },
    {
      gameId: 4,
      region: "worldwide",
      date: new Date("2026-09-30"),
      precision: "quarter",
    },
  ]);
  for (const id of [1, 3, 4, 5])
    await journal.set("mario", id, { status: "wishlist" });
  await journal.set("mario", 2, { status: "backlog" });
  await journal.setRegion("mario", "europe");

  const feed =
    (await journal.calendarFeed(await journal.feedToken("mario"))) ?? "";
  const lines = feed.split("\r\n");

  expect(feed.endsWith("END:VCALENDAR\r\n")).toBe(true);
  expect(
    lines.every((line) => new TextEncoder().encode(line).length <= 75),
  ).toBe(true);
  const events = feed
    .replace(/\r\n /g, "")
    .split("BEGIN:VEVENT")
    .slice(1)
    .map((event) =>
      event.split("\r\n").filter((l) => /^(UID|DTSTART|DTEND|SUMMARY)/.test(l)),
    );
  expect(events).toEqual([
    [
      "UID:game-3@shelve.games",
      "DTSTART;VALUE=DATE:20261201",
      "DTEND;VALUE=DATE:20261202",
      "SUMMARY:Hollow Knight: Silksong\\, Deluxe\\; Edition — Collector’s Bündle für alle releases",
    ],
    [
      "UID:game-1@shelve.games",
      "DTSTART;VALUE=DATE:20261231",
      "DTEND;VALUE=DATE:20270101",
      "SUMMARY:Game 1 releases",
    ],
  ]);
});

test("finished games are distinct Played entries per playthrough end year, scoped to the owner", async () => {
  await journal.set("mario", 1, { status: "played" });
  await journal.set("mario", 2, { status: "playing" });
  await journal.set("luigi", 1, { status: "played" });
  for (const endedOn of ["2024-12-31", "2026-01-01", "2026-06-01", null])
    await journal.addPlaythrough("mario", 1, {
      platform: "PlayStation 5",
      startedOn: "2024-01-01",
      endedOn,
    });
  for (const [owner, gameId] of [
    ["mario", 2],
    ["luigi", 1],
  ] as const)
    await journal.addPlaythrough(owner, gameId, {
      platform: "PlayStation 5",
      startedOn: "2025-01-01",
      endedOn: "2025-12-31",
    });
  expect((await journal.stats("mario")).finishedPerYear).toEqual([
    { year: 2024, games: 1 },
    { year: 2026, games: 1 },
  ]);
  expect((await journal.stats("nobody")).finishedPerYear).toEqual([]);
});

test("hours sum every logged playthrough by platform, preserving decimals and zero", async () => {
  await journal.set("mario", 1, { status: "played" });
  await journal.set("mario", 2, { status: "backlog" });
  await journal.set("luigi", 1, { status: "played" });
  for (const [owner, gameId, platform, hours] of [
    ["mario", 1, "PlayStation 5", 12.25],
    ["mario", 2, "PlayStation 5", 0.5],
    ["mario", 1, "PlayStation 4", 0],
    ["mario", 2, "PlayStation 4", null],
    ["luigi", 1, "PlayStation 5", 99],
  ] as const)
    await journal.addPlaythrough(owner, gameId, {
      platform,
      hours,
      startedOn: "2026-01-01",
    });
  expect((await journal.stats("mario")).hoursByPlatform).toEqual([
    { platform: "PlayStation 5", hours: 12.75 },
    { platform: "PlayStation 4", hours: 0 },
  ]);
  expect((await journal.stats("nobody")).hoursByPlatform).toEqual([]);
});

test("backlog history replays status events in order, including removals and re-additions", async () => {
  const change = async (
    day: string,
    gameId: number,
    status: "backlog" | "playing" | "played" | null,
  ) => {
    vi.setSystemTime(new Date(`${day}T23:00:00Z`));
    if (status === null) await journal.remove("mario", gameId);
    else await journal.set("mario", gameId, { status });
  };
  await change("2026-01-01", 1, "backlog");
  await change("2026-01-01", 2, "backlog");
  await journal.set("luigi", 1, { status: "backlog" });
  await change("2026-01-03", 1, "playing");
  await change("2026-02-01", 2, null);
  await change("2026-03-01", 1, "backlog");
  await change("2026-03-01", 1, "played");
  await change("2026-04-01", 2, "backlog");
  expect((await journal.stats("mario")).backlogOverTime).toEqual([
    { day: "2026-01-01", games: 2 },
    { day: "2026-01-03", games: 1 },
    { day: "2026-02-01", games: 0 },
    { day: "2026-03-01", games: 0 },
    { day: "2026-04-01", games: 1 },
  ]);
  expect((await journal.stats("nobody")).backlogOverTime).toEqual([]);
});

test("public profiles include the journal and playthroughs without notes or account secrets", async () => {
  await journal.setProfileVisibility("mario", "public");
  await db
    .update(user)
    .set({
      username: "mario",
      image: "https://example.com/avatar.png",
      feedToken: "secret-feed",
    })
    .where(eq(user.id, "mario"));
  await journal.set("mario", 1, {
    status: "played",
    completionTag: "completed",
  });
  await journal.set("mario", 2, { status: "wishlist" });
  await journal.addPlaythrough("mario", 1, {
    platform: "PlayStation 5",
    startedOn: "2026-01-01",
    endedOn: "2026-01-10",
    hours: 12,
    notes: "Private thoughts that must never be public",
  });
  await journal.set("luigi", 2, { status: "backlog" });
  await journal.addPlaythrough("luigi", 2, {
    platform: "PlayStation 4",
    startedOn: "2025-01-01",
    notes: "Luigi's secret",
  });

  expect(await journal.hasPublicProfile("MARIO")).toBe(true);
  expect(await journal.hasPublicProfile("unknown")).toBe(false);
  const profile = await journal.publicProfile("MARIO");
  expect(profile).toMatchObject({
    username: "mario",
    image: "https://example.com/avatar.png",
    library: [
      { gameId: 2, status: "wishlist" },
      { gameId: 1, status: "played", completionTag: "completed" },
    ],
    wishlist: [{ gameId: 2 }],
    playthroughs: [
      {
        gameId: 1,
        platform: "PlayStation 5",
        startedOn: "2026-01-01",
        endedOn: "2026-01-10",
        hours: 12,
      },
    ],
    stats: {
      finishedPerYear: [{ year: 2026, games: 1 }],
      hoursByPlatform: [{ platform: "PlayStation 5", hours: 12 }],
    },
  });
  expect(profile?.playthroughs).toHaveLength(1);
  expect(JSON.stringify(profile)).not.toMatch(
    /notes|Private thoughts|secret|email|userId/i,
  );
  expect(await journal.publicProfile("unknown")).toBeNull();
});

test("recording outside the journal validates before adding the chosen status and preserves existing tags", async () => {
  const submissionId = randomUUID();
  const input = { platform: "PlayStation 5", startedOn: "2026-01-01" };
  await expect(
    journal.recordPlaythrough(
      "mario",
      1,
      { ...input, endedOn: "2025-01-01" },
      "backlog",
      submissionId,
    ),
  ).rejects.toThrow(JournalError);
  expect(await journal.entry("mario", 1)).toBeNull();
  await journal.recordPlaythrough("mario", 1, input, "backlog", submissionId);
  await journal.recordPlaythrough("mario", 1, input, "backlog", submissionId);
  expect(await journal.entry("mario", 1)).toMatchObject({ status: "backlog" });
  expect(await journal.playthroughs("mario", 1)).toHaveLength(1);
  await journal.recordPlaythrough(
    "mario",
    1,
    { ...input, notes: "Corrected after a lost response" },
    "backlog",
    submissionId,
  );
  expect(await journal.playthroughs("mario", 1)).toEqual([
    expect.objectContaining({ notes: "Corrected after a lost response" }),
  ]);
  await journal.set("mario", 1, {
    status: "played",
    completionTag: "completed",
  });
  await journal.recordPlaythrough("mario", 1, input, "playing", randomUUID());
  expect(await journal.entry("mario", 1)).toMatchObject({
    status: "played",
    completionTag: "completed",
  });
});

test("Home reads keep new Playing entries, stable addition order and owner-only note-free projections", async () => {
  await db.insert(game).values(
    [3, 4, 5, 6].map((id) => ({
      id,
      title: `Game ${id}`,
      slug: `game-${id}`,
      genres: [],
      platforms: ["PlayStation 5"],
      syncedAt: new Date(),
    })),
  );
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  await journal.set("mario", 1, { status: "backlog" });
  vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
  for (const [gameId, status] of [
    [5, "wishlist"],
    [4, "played"],
    [3, "backlog"],
    [2, "playing"],
  ] as const)
    await journal.set("mario", gameId, { status });
  vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
  await journal.set("mario", 6, { status: "playing" });
  await journal.set("mario", 1, { status: "played" });
  await journal.set("luigi", 1, { status: "wishlist" });
  await journal.addPlaythrough("mario", 5, {
    platform: "PlayStation 5",
    startedOn: "2026-02-01",
    notes: "Private Home note",
  });
  const entries = await journal.library("mario");
  expect(
    entries.slice(0, 4).map((entry) => [entry.gameId, entry.status]),
  ).toEqual([
    [6, "playing"],
    [2, "playing"],
    [3, "backlog"],
    [4, "played"],
  ]);
  expect(entries.at(-1)).toMatchObject({
    gameId: 1,
    addedAt: new Date("2026-01-01T00:00:00Z"),
  });
  expect(entries).toHaveLength(6);
  const wishlist = await journal.wishlist("mario");
  expect(wishlist.map((entry) => entry.gameId)).toEqual([5]);
  expect(JSON.stringify({ entries, wishlist })).not.toMatch(
    /notes|Private Home note|luigi|userId/,
  );
});

test("account export includes only the owner's public and private lists in saved Catalog order", async () => {
  const { createLists } = await import("./lists");
  const lists = createLists(db);
  const ids: string[] = [];
  for (const [actor, visibility] of [
    ["mario", "private"],
    ["mario", "public"],
    ["luigi", "private"],
  ] as const) {
    const created = await lists.create(actor, {
      title: `${actor} ${visibility}`,
      visibility,
      submissionId: randomUUID(),
    });
    if (!created.ok) throw new Error(created.message);
    ids.push(created.value.id);
    await lists.addGame(actor, created.value.id, 0, 1);
    await lists.addGame(actor, created.value.id, 1, 2);
    await lists.reorder(actor, created.value.id, 2, [2, 1]);
  }
  const exported = await journal.exportData("mario");
  expect(exported.lists).toHaveLength(2);
  expect(exported.lists).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: ids[0],
        title: "mario private",
        visibility: "private",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        games: [
          { gameId: 2, title: "Game 2", slug: "game-2", coverImageId: null },
          { gameId: 1, title: "Game 1", slug: "game-1", coverImageId: null },
        ],
      }),
      expect.objectContaining({
        id: ids[1],
        title: "mario public",
        visibility: "public",
      }),
    ]),
  );
  expect(JSON.stringify(exported.lists)).not.toMatch(
    /luigi|submissionId|feedToken/,
  );
  const survivor = await journal.exportData("luigi");
  await journal.deleteAccount("mario", "DELETE");
  expect(await lists.ownerCollection("mario")).toEqual([]);
  expect(await lists.ownerDetail("mario", ids[0])).toBeNull();
  expect(await journal.exportData("luigi")).toEqual(survivor);
  const { listEntry } = await import("@/db/schema");
  expect(
    await db.select().from(listEntry).where(eq(listEntry.listId, ids[0])),
  ).toEqual([]);
  expect(
    await db.select().from(listEntry).where(eq(listEntry.listId, ids[1])),
  ).toEqual([]);
  expect((await db.select().from(game)).map((g) => g.id).sort()).toEqual([
    1, 2,
  ]);
});

test("a Played or Playing game takes any Rating from 1 to 10 points, read back with its entry", async () => {
  await journal.set("mario", 1, { status: "played" });
  await journal.set("mario", 2, { status: "playing" });
  for (const points of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    await journal.setRating("mario", 1, points);
    await journal.setRating("mario", 2, points);
    expect(await journal.entry("mario", 1)).toMatchObject({
      rating: points,
      ratedAt: expect.any(Date),
    });
    expect(await journal.entry("mario", 2)).toMatchObject({ rating: points });
  }
});

test("a Rating outside 1 to 10 whole points is rejected with a user-safe error", async () => {
  await journal.set("mario", 1, { status: "played" });
  for (const points of [0, 11, 3.5, -1, Number.NaN, "7", null, undefined, {}])
    await expect(journal.setRating("mario", 1, points)).rejects.toThrow(
      new JournalError("Choose a Rating from half a star to 5 stars."),
    );
  expect(await journal.entry("mario", 1)).toMatchObject({
    rating: null,
    ratedAt: null,
  });
});

test("rating a game outside the Journal or not Played or Playing explains why and writes nothing", async () => {
  await expect(journal.setRating("mario", 1, 8)).rejects.toThrow(
    new JournalError("This game is not in your Journal."),
  );
  expect(await journal.entry("mario", 1)).toBeNull();
  for (const status of ["backlog", "wishlist"] as const) {
    await journal.set("mario", 1, { status });
    await expect(journal.setRating("mario", 1, 8)).rejects.toThrow(
      new JournalError("Mark it Played or Playing to rate it."),
    );
    expect(await journal.entry("mario", 1)).toMatchObject({ rating: null });
  }
  // Another player's entry doesn't count as yours.
  await journal.set("luigi", 2, { status: "played" });
  await expect(journal.setRating("mario", 2, 8)).rejects.toThrow(
    "This game is not in your Journal.",
  );
  expect(await journal.entry("luigi", 2)).toMatchObject({ rating: null });
});

test("resubmitting the same Rating keeps rated-at; a new value updates it", async () => {
  await journal.set("mario", 1, { status: "played" });
  vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
  await journal.setRating("mario", 1, 7);
  vi.setSystemTime(new Date("2026-01-02T10:00:00Z"));
  await journal.setRating("mario", 1, 7);
  expect(await journal.entry("mario", 1)).toMatchObject({
    rating: 7,
    ratedAt: new Date("2026-01-01T10:00:00Z"),
  });
  vi.setSystemTime(new Date("2026-01-03T10:00:00Z"));
  await journal.setRating("mario", 1, 9);
  expect(await journal.entry("mario", 1)).toMatchObject({
    rating: 9,
    ratedAt: new Date("2026-01-03T10:00:00Z"),
  });
});

test("rating leaves updated-at and status history alone, so a Status move seen before it still succeeds", async () => {
  await journal.set("mario", 1, { status: "backlog" });
  const seen = await journal.move("mario", 1, { status: "backlog" }, "played");
  const events = await journal.statusEvents("mario");

  await journal.setRating("mario", 1, 6);
  await journal.clearRating("mario", 1);
  await journal.setRating("mario", 1, 8);

  expect(await journal.entry("mario", 1)).toMatchObject({ updatedAt: seen });
  expect(await journal.statusEvents("mario")).toEqual(events);
  expect(
    await journal.move(
      "mario",
      1,
      { status: "played", updatedAt: seen ?? undefined },
      "backlog",
    ),
  ).toBeInstanceOf(Date);
});

test("a Rating stays through every Status change, and can be cleared in any Status", async () => {
  await journal.set("mario", 1, {
    status: "played",
    completionTag: "completed",
  });
  await journal.setRating("mario", 1, 8);
  for (const status of ["backlog", "wishlist", "playing", "played"] as const) {
    await journal.set("mario", 1, { status });
    expect(await journal.entry("mario", 1)).toMatchObject({
      status,
      rating: 8,
    });
  }
  await journal.move("mario", 1, { status: "played" }, "backlog");
  expect(await journal.entry("mario", 1)).toMatchObject({ rating: 8 });

  for (const status of ["played", "playing", "backlog", "wishlist"] as const) {
    await journal.set("mario", 1, { status: "played" });
    await journal.setRating("mario", 1, 4);
    await journal.set("mario", 1, { status });
    await journal.clearRating("mario", 1);
    await journal.clearRating("mario", 1); // already clear: no-op
    expect(await journal.entry("mario", 1)).toMatchObject({
      status,
      rating: null,
      ratedAt: null,
    });
  }
  // Clearing a game outside the Journal is a no-op, not an error.
  await expect(journal.clearRating("mario", 2)).resolves.toBeUndefined();
  expect(await journal.entry("mario", 2)).toBeNull();
});

test("the database rejects Ratings out of range or without rated-at", async () => {
  await journal.set("mario", 1, { status: "played" });
  for (const values of [
    { rating: 0, ratedAt: new Date() },
    { rating: 11, ratedAt: new Date() },
    { rating: 5, ratedAt: null },
    { rating: null, ratedAt: new Date() },
  ])
    await expect(
      db
        .update(journalEntry)
        // Out-of-range points on purpose: the check constraint is what's under test.
        .set(values as { rating: RatingPoints | null; ratedAt: Date | null })
        .where(eq(journalEntry.gameId, 1)),
    ).rejects.toThrow();
  expect(await journal.entry("mario", 1)).toMatchObject({ rating: null });
});

/** Gives game `gameId` one Rating per points value, each from a new Played player. */
async function rateByNewPlayers(gameId: number, points: number[]) {
  for (const [i, p] of points.entries()) {
    const id = `player-${gameId}-${i}-${randomUUID()}`;
    await db.insert(user).values({ id, name: id, email: `${id}@example.com` });
    await journal.set(id, gameId, { status: "played" });
    await journal.setRating(id, gameId, p);
  }
}

test("the Community rating counts Ratings and shows an average only from 5 Ratings", async () => {
  expect(await journal.communityRating(1)).toEqual({
    count: 0,
    average: null,
    distribution: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });
  await rateByNewPlayers(1, [10, 9, 9, 2]);
  await journal.set("mario", 1, { status: "backlog" }); // unrated: ignored
  await rateByNewPlayers(2, [1, 1, 1, 1, 1]); // another game's
  expect(await journal.communityRating(1)).toEqual({
    count: 4,
    average: null,
    distribution: [0, 1, 0, 0, 0, 0, 0, 0, 2, 1],
  });
  await rateByNewPlayers(1, [5]);
  expect(await journal.communityRating(1)).toEqual({
    count: 5,
    average: 3.5, // 35 points ÷ 5 = 7 points = 3.5 stars
    distribution: [0, 1, 0, 0, 1, 0, 0, 0, 2, 1],
  });
});

test("the Community rating average rounds half up to one decimal, exactly", async () => {
  // 46 points over 20 Ratings is 1.15 stars, which floating point rounds down.
  await rateByNewPlayers(1, [...Array(14).fill(2), ...Array(6).fill(3)]);
  expect(await journal.communityRating(1)).toMatchObject({
    count: 20,
    average: 1.2,
  });
  // 39 points over 6 Ratings is 3.25 stars.
  await rateByNewPlayers(2, [7, 7, 7, 6, 6, 6]);
  expect(await journal.communityRating(2)).toMatchObject({ average: 3.3 });
});

test("the Community rating counts Ratings kept on Backlog and Wishlist games", async () => {
  await rateByNewPlayers(1, [8, 8, 8, 8]);
  await journal.set("mario", 1, { status: "played" });
  await journal.setRating("mario", 1, 3);
  await journal.set("mario", 1, { status: "wishlist" });
  await journal.set("luigi", 1, { status: "playing" });
  await journal.setRating("luigi", 1, 3);
  await journal.set("luigi", 1, { status: "backlog" });
  expect(await journal.communityRating(1)).toMatchObject({ count: 6 });
});

test("removing a rated game needs confirmation, then drops its Rating from the Community rating", async () => {
  await rateByNewPlayers(1, [6, 6, 6, 6]);
  await journal.set("mario", 1, { status: "played" });
  await journal.setRating("mario", 1, 10);
  await journal.set("mario", 1, { status: "backlog" });
  for (const acknowledgement of [undefined, false, "true"])
    await expect(journal.remove("mario", 1, acknowledgement)).resolves.toEqual({
      confirmationRequired: true,
      playthroughCount: 0,
      rated: true,
    });
  expect(await journal.entry("mario", 1)).toMatchObject({ rating: 10 });
  expect(await journal.communityRating(1)).toMatchObject({
    count: 5,
    average: 3.4,
  });

  await journal.remove("mario", 1, true);
  expect(await journal.entry("mario", 1)).toBeNull();
  expect(await journal.communityRating(1)).toMatchObject({
    count: 4,
    average: null,
  });
});

test("deleting an account removes its Ratings from the Community rating", async () => {
  await rateByNewPlayers(1, [4, 4, 4, 4]);
  await journal.set("mario", 1, { status: "played" });
  await journal.setRating("mario", 1, 4);
  expect(await journal.communityRating(1)).toMatchObject({ count: 5 });

  await journal.deleteAccount("mario", "DELETE");
  expect(await journal.communityRating(1)).toMatchObject({
    count: 4,
    average: null,
  });
});

test("export and the entry carry each Rating and when it changed; Library entries and the public profile carry only the Rating, never notes", async () => {
  await journal.setProfileVisibility("mario", "public");
  await db.update(user).set({ username: "mario" }).where(eq(user.id, "mario"));
  await journal.set("mario", 1, { status: "played" });
  await journal.set("mario", 2, { status: "backlog" });
  await journal.addPlaythrough("mario", 1, {
    platform: "PlayStation 5",
    startedOn: "2026-01-01",
    notes: "Private thoughts",
  });
  vi.setSystemTime(new Date("2026-03-01T10:00:00Z"));
  await journal.setRating("mario", 1, 9);
  vi.useRealTimers();
  const rated = {
    gameId: 1,
    rating: 9,
    ratedAt: new Date("2026-03-01T10:00:00Z"),
  };
  const unrated = { gameId: 2, rating: null, ratedAt: null };

  expect((await journal.exportData("mario")).entries).toEqual([
    expect.objectContaining(rated),
    expect.objectContaining(unrated),
  ]);
  expect(await journal.entry("mario", 1)).toMatchObject(rated);
  // When a Rating changed stays private: the Library and public profile carry only the points.
  const shown = [
    { gameId: 1, rating: 9 },
    { gameId: 2, rating: null },
  ];
  const library = await journal.library("mario", {}, "title");
  expect(library).toEqual(shown.map((e) => expect.objectContaining(e)));
  expect(library.some((e) => "ratedAt" in e)).toBe(false);
  const profile = await journal.publicProfile("mario");
  expect(
    [...(profile?.library ?? [])].sort((a, b) => a.gameId - b.gameId),
  ).toEqual(shown.map((e) => expect.objectContaining(e)));
  expect(JSON.stringify(profile)).not.toMatch(
    /notes|Private thoughts|ratedAt|rated_at/i,
  );
});

test("stats report the owner's Rating distribution, average Rating given and number of rated games", async () => {
  expect((await journal.stats("mario")).ratings).toEqual({
    count: 0,
    average: null,
    distribution: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });
  await journal.set("mario", 1, { status: "played" });
  await journal.setRating("mario", 1, 9);
  await journal.set("mario", 2, { status: "playing" });
  await journal.setRating("mario", 2, 4);
  await journal.set("mario", 2, { status: "wishlist" }); // kept, still counts
  await journal.set("luigi", 1, { status: "played" });
  await journal.setRating("luigi", 1, 1);

  // 13 points over 2 Ratings is 3.25 stars, so no threshold and half up.
  expect((await journal.stats("mario")).ratings).toEqual({
    count: 2,
    average: 3.3,
    distribution: [0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  });
});

test("new profiles are Private, only their owner can preview them, and visibility round-trips", async () => {
  await db.update(user).set({ username: "mario" }).where(eq(user.id, "mario"));
  expect(await journal.profileVisibility("mario")).toBe("private");
  expect(await journal.publicProfile("MARIO")).toBeNull();
  expect(await journal.hasPublicProfile("MARIO")).toBe(false);
  expect(await journal.profileForViewer("mario", null)).toBeNull();
  expect(await journal.profileForViewer("mario", "luigi")).toBeNull();
  expect(await journal.profileForViewer("MARIO", "mario")).toMatchObject({
    username: "mario",
    visibility: "private",
  });
  await journal.setProfileVisibility("mario", "public");
  expect(await journal.profileVisibility("mario")).toBe("public");
  expect(await journal.hasPublicProfile("MARIO")).toBe(true);
  expect(await journal.publicProfile("mario")).toMatchObject({
    username: "mario",
  });
  await journal.setProfileVisibility("mario", "private");
  expect(await journal.publicProfile("mario")).toBeNull();
  await expect(
    journal.setProfileVisibility("mario", "friends"),
  ).rejects.toThrow(/visibility/i);
  expect(await journal.profileVisibility("mario")).toBe("private");
});

test("the visibility migration keeps existing shared profiles Public and new profiles Private", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { readMigrationFiles } = await import("drizzle-orm/migrator");
  const client = new PGlite();
  try {
    const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
    const visibilityMigration = migrations.findIndex((migration) =>
      migration.sql.some((sql) =>
        sql.includes('ADD COLUMN "profile_visibility"'),
      ),
    );
    expect(visibilityMigration).toBeGreaterThan(0);
    for (const migration of migrations.slice(0, visibilityMigration)) {
      for (const statement of migration.sql) await client.exec(statement);
    }
    await client.exec(
      `insert into "user" (id, name, email, username) values ('existing', 'Existing', 'existing@example.com', 'existing')`,
    );
    for (const migration of migrations.slice(visibilityMigration)) {
      for (const statement of migration.sql) await client.exec(statement);
    }
    const migrated = createJournal(drizzle(client) as unknown as Db);
    expect(await migrated.hasPublicProfile("existing")).toBe(true);
    await client.exec(
      `insert into "user" (id, name, email, username) values ('new', 'New', 'new@example.com', 'new')`,
    );
    expect(await migrated.profileVisibility("new")).toBe("private");
    expect(await migrated.publicProfile("new")).toBeNull();
    await expect(
      client.exec(
        `update "user" set profile_visibility = 'friends' where id = 'new'`,
      ),
    ).rejects.toThrow();
  } finally {
    await client.close();
  }
});
