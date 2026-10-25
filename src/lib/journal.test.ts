import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Db } from "@/db";
import { game, user } from "@/db/schema";
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
