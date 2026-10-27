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
  await journal.remove("mario", 1);
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
      "UID:game-3@vgame-journal",
      "DTSTART;VALUE=DATE:20261201",
      "DTEND;VALUE=DATE:20261202",
      "SUMMARY:Hollow Knight: Silksong\\, Deluxe\\; Edition — Collector’s Bündle für alle releases",
    ],
    [
      "UID:game-1@vgame-journal",
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
