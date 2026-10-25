import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Db } from "@/db";
import { game, releaseDate, user } from "@/db/schema";
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
