import { sql } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import { user } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { createFakeGameSource, sourceGame } from "@/test/fake-game-source";
import { createCatalog } from "./catalog";
import { createJournal } from "./journal";
import { nextBatch, releasedOn, validPlayNextRequest } from "./play-next";
import { createPlayNext } from "./play-next-server";

const released = (id: number) =>
  sourceGame({
    id,
    platforms: ["PC", "Switch"],
    genres: ["Adventure"],
    releaseDates: [
      {
        platform: "PC",
        date: new Date("2020-01-01"),
        precision: "day",
        region: "worldwide",
        status: null,
      },
      {
        platform: "Switch",
        date: new Date("2099-01-01"),
        precision: "day",
        region: "worldwide",
        status: null,
      },
    ],
    popularity: 1000 - id,
  });
async function setup(count = 8) {
  const db = await createTestDb();
  await db.insert(user).values([
    { id: "one", name: "One", email: "one@test.invalid" },
    { id: "two", name: "Two", email: "two@test.invalid" },
  ]);
  const games = Array.from({ length: count }, (_, i) => released(i + 1));
  const source = createFakeGameSource(games, [], {
    1: { similar: [2], series: [10], genres: [31] },
    2: { series: [10] },
    3: { series: [10] },
    4: { genres: [31] },
    5: { franchises: [20] },
  });
  const catalog = createCatalog(db, source);
  await catalog.save(games);
  const journal = createJournal(db);
  return { db, games, source, catalog, journal, read: createPlayNext(catalog) };
}

test("platform release checks exclude future ports, unknown dates, and mismatched filters", () => {
  expect(releasedOn(released(1), { platform: "PC", genre: "Adventure" })).toBe(
    true,
  );
  expect(releasedOn(released(1), { platform: "Switch", genre: "" })).toBe(
    false,
  );
  expect(
    releasedOn(
      { ...released(1), releaseDates: [] },
      { platform: "", genre: "" },
    ),
  ).toBe(false);
  expect(releasedOn(released(1), { platform: "PC", genre: "Puzzle" })).toBe(
    false,
  );
  expect(
    validPlayNextRequest({ platform: 'PC"; where id > 0;', genre: "" }),
  ).toBe(true); // Provider quotes strings, never interpolates query syntax.
  expect(validPlayNextRequest({ platform: "\u0000", genre: "" })).toBe(false);
});

test("every eligible imported Backlog entry can appear without any provider work", async () => {
  const { journal, read, source } = await setup(150);
  for (let id = 1; id <= 150; id++)
    await journal.set("one", id, { status: "backlog" });
  const external = vi.spyOn(source, "fetchRecommendationSeeds");
  const result = await read("one", { platform: "PC", genre: "" });
  expect(result.source).toBe("backlog");
  expect(new Set(result.games.map((game) => game.id)).size).toBe(150);
  expect(external).not.toHaveBeenCalled();
  expect(
    (await read("two", { source: "backlog", platform: "", genre: "" })).games,
  ).toEqual([]);
});

test("Discover excludes all Journal statuses, favors relationship evidence, and varies series", async () => {
  const { journal, read } = await setup();
  await journal.set("one", 1, { status: "backlog" });
  await journal.set("one", 6, { status: "wishlist" });
  await journal.set("one", 7, { status: "played" });
  await journal.set("one", 8, { status: "playing" });
  const result = await read("one", {
    source: "discover",
    platform: "PC",
    genre: "",
  });
  expect(result.provenance).toBe("related");
  expect(result.games.map((game) => game.id)).toEqual([2, 3, 4]);
  expect(result.games[0].reason).toContain("Similar to Game 1");
  expect(result.games.every((game) => ![1, 6, 7, 8].includes(game.id))).toBe(
    true,
  );
  expect(await journal.playthroughs("one", 2)).toEqual([]);
  expect(nextBatch(result.games, []).map((game) => game.id)).toEqual([2, 4, 3]);
});

test("thin and exhausted related pools use labeled popular games; provider errors propagate", async () => {
  const { journal, source, catalog, read } = await setup(180);
  expect((await read("one", { platform: "PC", genre: "" })).provenance).toBe(
    "popular",
  );
  await journal.set("one", 1, { status: "backlog" });
  const failure = vi
    .spyOn(source, "fetchRecommendationPage")
    .mockRejectedValueOnce(new Error("offline"));
  await expect(
    createPlayNext(catalog)("one", {
      source: "discover",
      platform: "PC",
      genre: "",
    }),
  ).rejects.toThrow("offline");
  failure.mockRestore();
  const result = await read("one", {
    source: "discover",
    popular: true,
    platform: "PC",
    genre: "",
  });
  expect(result.provenance).toBe("popular");
  expect(result.games.length).toBe(179);
  expect(result.games[25].id).toBeGreaterThan(24);
  expect(result.games.every((game) => game.reason.startsWith("Popular"))).toBe(
    true,
  );
});

test("provider work stays finite when every early popular candidate is excluded", async () => {
  const { journal, source, read } = await setup(420);
  for (let id = 1; id <= 405; id++)
    await journal.set("one", id, { status: "played" });
  const pages = vi.spyOn(source, "fetchRecommendationPage");
  const result = await read("one", {
    source: "discover",
    platform: "PC",
    genre: "",
  });
  expect(result.games).toEqual([]);
  expect(result.bounded).toBe(true);
  expect(pages).toHaveBeenCalledTimes(4);
});

test("recommendation saves are atomic and never overwrite conflicting Journal state or add a Playthrough", async () => {
  const { journal } = await setup();
  expect(await journal.addRecommendation("one", 2, "backlog")).toBe(true);
  expect(await journal.addRecommendation("one", 2, "playing")).toBe(false);
  expect((await journal.entry("one", 2))?.status).toBe("backlog");
  expect(await journal.entry("two", 2)).toBeNull();
  const original = await journal.entry("one", 2);
  await journal.set("one", 2, { status: "wishlist" });
  expect(
    await journal.move(
      "one",
      2,
      { status: "backlog", updatedAt: original?.updatedAt },
      "playing",
    ),
  ).toBeNull();
  expect(await journal.playthroughs("one", 2)).toEqual([]);
  expect(
    (await journal.statusEvents("one")).map((event) => event.status),
  ).toEqual(["backlog", "wishlist"]);
});

test("a failed recommendation history write rolls back membership", async () => {
  const { db, journal } = await setup();
  await db.execute(
    sql`create function fail_recommendation_event() returns trigger language plpgsql as $$ begin raise exception 'synthetic failure'; end $$`,
  );
  await db.execute(
    sql`create trigger fail_recommendation_event before insert on status_event for each row execute function fail_recommendation_event()`,
  );
  await expect(
    journal.addRecommendation("one", 2, "playing"),
  ).rejects.toThrow();
  expect(await journal.entry("one", 2)).toBeNull();
  expect(await journal.statusEvents("one")).toEqual([]);
});
