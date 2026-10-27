import { afterEach, expect, test, vi } from "vitest";
import { game, journalEntry, user } from "@/db/schema";
import type { DatePrecision } from "@/lib/game-source";
import { createTestDb } from "@/test/db";
import { createFakeGameSource, sourceGame } from "@/test/fake-game-source";
import { createCatalog } from "./catalog";

afterEach(() => {
  vi.useRealTimers();
});

test("a query the catalog hasn't seen falls back to the game source", async () => {
  const source = createFakeGameSource([
    sourceGame({
      id: 42,
      title: "Hollow Knight",
      coverImageId: "co1rgi",
      platforms: ["PC", "Nintendo Switch"],
      releaseDates: [
        {
          platform: "PC",
          region: "worldwide",
          date: new Date("2017-02-24"),
          precision: "day",
          status: "Full Release",
        },
      ],
    }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);

  expect(await catalog.search("hollow")).toEqual([
    {
      id: 42,
      title: "Hollow Knight",
      slug: "game-42",
      coverImageId: "co1rgi",
      year: 2017,
      platforms: ["PC", "Nintendo Switch"],
    },
  ]);
});

test("a repeated query is served from the catalog for 24 hours", async () => {
  const source = createFakeGameSource([sourceGame({ title: "Celeste" })]);
  const catalog = createCatalog(await createTestDb(), source);
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

  const first = await catalog.search("celeste");
  vi.setSystemTime(new Date("2026-01-01T23:59:00Z"));
  const again = await catalog.search("  Celeste ");

  expect(again).toEqual(first);
  expect(source.searches).toBe(1);

  vi.setSystemTime(new Date("2026-01-02T00:01:00Z"));
  await catalog.search("celeste");
  expect(source.searches).toBe(2);
});

test("only main games, standalone expansions and remakes are kept", async () => {
  const source = createFakeGameSource([
    sourceGame({ title: "Resident Evil 2", type: "main_game" }),
    sourceGame({ title: "Resident Evil 2", type: "remake" }),
    sourceGame({
      title: "Resident Evil 2: Ghost Survivors",
      type: "dlc_addon",
    }),
    sourceGame({ title: "Resident Evil 2 Remastered", type: "remaster" }),
    sourceGame({ title: "Resident Evil 2 (Switch)", type: "port" }),
    sourceGame({
      title: "Resident Evil 2 Deluxe Edition",
      type: "expanded_game",
    }),
    sourceGame({ title: "Resident Evil 2 + 3 Bundle", type: "bundle" }),
    sourceGame({
      title: "Resident Evil 2: Extra Chapter",
      type: "standalone_expansion",
    }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);

  const titles = (await catalog.search("resident evil 2")).map((r) => r.title);

  expect(titles).toEqual([
    "Resident Evil 2",
    "Resident Evil 2",
    "Resident Evil 2: Extra Chapter",
  ]);
});

test("fan-made games are left out", async () => {
  const source = createFakeGameSource([
    sourceGame({ title: "Hollow Knight Silksong", fanMade: true }),
    sourceGame({ title: "Hollow Knight: Silksong" }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);

  const titles = (await catalog.search("silksong")).map((r) => r.title);

  expect(titles).toEqual(["Hollow Knight: Silksong"]);
});

test("the game you named comes first, then popular games, then the obscure ones", async () => {
  const source = createFakeGameSource([
    sourceGame({ title: "Super Mario Bros. Demake", popularity: 0 }),
    sourceGame({ title: "Super Mario Bros. Wonder", popularity: 226 }),
    sourceGame({ title: "Super Mario Bros. 2", popularity: 0 }),
    sourceGame({ title: "Super Mario Bros.", popularity: 0 }), // an untracked re-release
    sourceGame({ title: "Super Mario Bros. 3", popularity: 1746 }),
    sourceGame({ title: "Super Mario Bros.", popularity: 1331 }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);

  const results = await catalog.search("super mario bros");

  expect(results.map((r) => r.title)).toEqual([
    "Super Mario Bros.",
    "Super Mario Bros. 3",
    "Super Mario Bros. Wonder",
    "Super Mario Bros. Demake",
    "Super Mario Bros. 2",
    "Super Mario Bros.",
  ]);
  expect(results[0].id).not.toBe(results[5].id);
});

test("a searched game can be found by its slug, with scores and every release date", async () => {
  const source = createFakeGameSource([
    sourceGame({
      id: 7,
      title: "Hades II",
      slug: "hades-ii",
      summary: "Battle beyond the Underworld.",
      genres: ["Roguelike"],
      platforms: ["PC", "Nintendo Switch 2"],
      criticScore: 94.5,
      criticScoreCount: 40,
      userScore: null,
      userScoreCount: null,
      releaseDates: [
        {
          platform: "Nintendo Switch 2",
          region: "worldwide",
          date: new Date("2025-09-25"),
          precision: "day",
          status: "Full Release",
        },
        {
          platform: "PC",
          region: "worldwide",
          date: new Date("2024-05-06"),
          precision: "day",
          status: "Early Access",
        },
      ],
    }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);
  await catalog.search("hades");

  const game = await catalog.findBySlug("hades-ii");

  expect(game).toMatchObject({
    id: 7,
    title: "Hades II",
    summary: "Battle beyond the Underworld.",
    genres: ["Roguelike"],
    platforms: ["PC", "Nintendo Switch 2"],
    criticScore: 94.5,
    criticScoreCount: 40,
    userScore: null,
    userScoreCount: null,
  });
  expect(game?.releaseDates.map((d) => d.platform)).toEqual([
    "PC",
    "Nintendo Switch 2",
  ]);
  expect(await catalog.findBySlug("hades-iii")).toBeNull();
});

test("a game nobody has searched yet is fetched from the game source by slug, then kept", async () => {
  const source = createFakeGameSource([
    sourceGame({ title: "Celeste", slug: "celeste" }),
    sourceGame({
      title: "Celeste: Farewell",
      slug: "celeste-farewell",
      type: "dlc_addon",
    }),
    sourceGame({ title: "Celeste 64", slug: "celeste-64", fanMade: true }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);

  expect(await catalog.findBySlug("celeste")).toMatchObject({
    title: "Celeste",
  });
  expect(await catalog.findBySlug("celeste-farewell")).toBeNull();
  expect(await catalog.findBySlug("celeste-64")).toBeNull();

  expect((await catalog.search("celeste")).map((r) => r.title)).toEqual([
    "Celeste",
  ]);
});

test("refreshing release dates picks up a delay for wishlisted games still to come, and skips the rest", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
  const day = (date: string, precision: DatePrecision = "day") => [
    {
      platform: null,
      region: "worldwide",
      date: new Date(date),
      precision,
      status: null,
    },
  ];
  const games = [
    sourceGame({ id: 1, title: "Upcoming", releaseDates: day("2026-11-19") }),
    sourceGame({
      id: 2,
      title: "Vague",
      releaseDates: day("2027-12-31", "year"),
    }),
    sourceGame({ id: 3, title: "Released", releaseDates: day("2025-09-04") }),
    sourceGame({ id: 4, title: "Backlogged", releaseDates: day("2026-12-01") }),
    sourceGame({ id: 5, title: "Undated", releaseDates: [] }),
  ];
  const source = createFakeGameSource(games);
  const db = await createTestDb();
  const catalog = createCatalog(db, source);
  for (const g of games) await catalog.findBySlug(g.slug);
  await db
    .insert(user)
    .values({ id: "mario", name: "mario", email: "mario@example.com" });
  await db.insert(journalEntry).values(
    games.map((g) => ({
      userId: "mario",
      gameId: g.id,
      status: g.id === 4 ? ("backlog" as const) : ("wishlist" as const),
      updatedAt: new Date(),
    })),
  );
  // The source announces delays after the games were saved.
  games[0].releaseDates = day("2027-05-26");
  games[1].releaseDates = day("2027-03-31", "quarter");
  games[2].releaseDates = day("2030-01-01");
  games[3].releaseDates = day("2030-01-01");
  games[4].releaseDates = day("2027-02-01");
  vi.setSystemTime(new Date("2026-10-27T06:00:00Z"));

  expect(await catalog.refreshReleaseDates()).toBe(3);

  expect(source.releaseDateFetches.flat().sort()).toEqual([1, 2, 5]);
  const stored = async (slug: string) => {
    const g = await catalog.findBySlug(slug);
    return [
      g?.releaseDates.map((d) => [
        d.date?.toISOString().slice(0, 10),
        d.precision,
      ]),
      g?.syncedAt.toISOString().slice(0, 10),
    ];
  };
  expect(await stored("game-1")).toEqual([
    [["2027-05-26", "day"]],
    "2026-10-27",
  ]);
  expect(await stored("game-2")).toEqual([
    [["2027-03-31", "quarter"]],
    "2026-10-27",
  ]);
  expect(await stored("game-5")).toEqual([
    [["2027-02-01", "day"]],
    "2026-10-27",
  ]);
  expect(await stored("game-3")).toEqual([
    [["2025-09-04", "day"]],
    "2026-10-26",
  ]);
  expect(await stored("game-4")).toEqual([
    [["2026-12-01", "day"]],
    "2026-10-26",
  ]);
});

test("refreshing release dates asks the source in batches of 50", async () => {
  const games = Array.from({ length: 120 }, (_, i) =>
    sourceGame({ id: 1000 + i, title: `Game ${1000 + i}`, releaseDates: [] }),
  );
  const source = createFakeGameSource(games);
  const db = await createTestDb();
  const catalog = createCatalog(db, source);
  await db.insert(game).values(
    games.map((g) => ({
      id: g.id,
      title: g.title,
      slug: g.slug,
      genres: [],
      platforms: [],
      syncedAt: new Date(),
    })),
  );
  await db
    .insert(user)
    .values({ id: "mario", name: "mario", email: "mario@example.com" });
  await db.insert(journalEntry).values(
    games.map((g) => ({
      userId: "mario",
      gameId: g.id,
      status: "wishlist" as const,
      updatedAt: new Date(),
    })),
  );

  expect(await catalog.refreshReleaseDates()).toBe(120);
  expect(source.releaseDateFetches.map((ids) => ids.length)).toEqual([
    50, 50, 20,
  ]);
});

test("refreshing never wipes a game's dates when the source has none for it", async () => {
  const games = [
    sourceGame({
      id: 1,
      releaseDates: [
        {
          platform: null,
          region: "worldwide",
          date: new Date("2027-05-26"),
          precision: "day",
          status: null,
        },
      ],
    }),
  ];
  const source = createFakeGameSource(games);
  const db = await createTestDb();
  const catalog = createCatalog(db, source);
  await catalog.findBySlug("game-1");
  await db
    .insert(user)
    .values({ id: "mario", name: "mario", email: "mario@example.com" });
  await db.insert(journalEntry).values({
    userId: "mario",
    gameId: 1,
    status: "wishlist",
    updatedAt: new Date(),
  });
  games[0].releaseDates = [];

  await catalog.refreshReleaseDates();

  expect((await catalog.findBySlug("game-1"))?.releaseDates).toHaveLength(1);
});

test("the sitemap gets every catalog game, most recently synced first", async () => {
  const source = createFakeGameSource([
    sourceGame({ id: 1, title: "First" }),
    sourceGame({ id: 2, title: "Second" }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01"));
  await catalog.findBySlug("game-1");
  vi.setSystemTime(new Date("2026-01-02"));
  await catalog.findBySlug("game-2");

  expect((await catalog.indexedGames()).map((g) => g.slug)).toEqual([
    "game-2",
    "game-1",
  ]);
  expect(await catalog.indexedGames(1)).toHaveLength(1);
});
