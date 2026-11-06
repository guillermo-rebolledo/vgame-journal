import { afterEach, expect, test, vi } from "vitest";
import { game, journalEntry, searchCache, user } from "@/db/schema";
import type { DatePrecision } from "@/lib/game-source";
import { createTestDb } from "@/test/db";
import { createFakeGameSource, sourceGame } from "@/test/fake-game-source";
import { createCatalog } from "./catalog";
import { createJournal } from "./journal";

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

test("search retains the full bounded candidate set across cache reuse and bypasses legacy truncated entries", async () => {
  const games = Array.from({ length: 50 }, (_, i) =>
    sourceGame({
      id: i + 1,
      title: `Quest ${i + 1}`,
      popularity: 50 - i,
      platforms: i === 24 ? ["Switch"] : ["PC"],
      releaseDates: [
        {
          platform: null,
          region: "worldwide",
          date: new Date(i === 24 ? "2024-01-01" : "2018-01-01"),
          precision: "year",
          status: null,
        },
      ],
    }),
  );
  const source = createFakeGameSource(games);
  const db = await createTestDb();
  await db.insert(game).values(
    games.slice(0, 20).map((g) => ({
      id: g.id,
      title: g.title,
      slug: g.slug,
      genres: [],
      platforms: g.platforms,
      syncedAt: new Date(),
    })),
  );
  // A still-fresh cache from the former implementation contains only 20 IDs.
  await db.insert(searchCache).values({
    query: "quest",
    gameIds: games.slice(0, 20).map((g) => g.id),
    fetchedAt: new Date(),
  });
  const catalog = createCatalog(db, source);
  const results = await catalog.search("  Quest  ");
  expect(results).toHaveLength(50);
  expect(results[24]).toMatchObject({
    id: 25,
    year: 2024,
    platforms: ["Switch"],
  });
  expect(results.map((g) => g.id)).toEqual(games.map((g) => g.id));
  const reopened = createCatalog(db, source);
  expect(await reopened.search("quest")).toEqual(results);
  expect(source.searches).toBe(1);
});

test("search stays within fifty source candidates even if a source returns extra records", async () => {
  const source = createFakeGameSource(
    Array.from({ length: 51 }, (_, i) =>
      sourceGame({
        id: i + 1,
        title: `Quest ${i + 1}`,
        popularity: i === 50 ? 1000 : 0,
      }),
    ),
  );
  const catalog = createCatalog(await createTestDb(), source);
  const results = await catalog.search("quest");
  expect(results).toHaveLength(50);
  expect(results[0].id).toBe(1);
  expect(results.at(-1)?.id).toBe(50);
  expect(source.searches).toBe(1);
});

test("discovery projects the same earliest known year and platform availability as search", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
  const source = createFakeGameSource([
    sourceGame({
      id: 7,
      title: "Old Quest",
      coverImageId: "cover",
      platforms: ["PC", "Nintendo Switch"],
      visits: 100,
      releaseDates: [
        {
          platform: "PC",
          region: "worldwide",
          date: new Date("1990-01-01"),
          precision: "tbd",
          status: null,
        },
        {
          platform: "Nintendo Switch",
          region: "worldwide",
          date: new Date("2024-01-01"),
          precision: "year",
          status: null,
        },
        {
          platform: "PC",
          region: "worldwide",
          date: new Date("2018-05-01"),
          precision: "day",
          status: null,
        },
      ],
    }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);
  await catalog.refreshDiscovery();
  const [shelf] = await catalog.discovery();
  expect(shelf.games).toEqual([
    {
      id: 7,
      title: "Old Quest",
      slug: "game-7",
      coverImageId: "cover",
      year: 2018,
      platforms: ["PC", "Nintendo Switch"],
    },
  ]);
  expect(shelf.refreshedAt.getUTCFullYear()).toBe(2026);
  expect(await catalog.search("old quest")).toEqual(shelf.games);
});

test("standalone expanded games are kept while editions and other excluded types are left out", async () => {
  const source = createFakeGameSource([
    sourceGame({ title: "Resident Evil 2", type: "main_game" }),
    sourceGame({ title: "Resident Evil 2", type: "remake" }),
    sourceGame({ title: "Resident Evil 2 Expanded", type: "expanded_game" }),
    sourceGame({
      title: "Resident Evil 2: Ghost Survivors",
      type: "dlc_addon",
    }),
    sourceGame({ title: "Resident Evil 2 Remastered", type: "remaster" }),
    sourceGame({ title: "Resident Evil 2 (Switch)", type: "port" }),
    sourceGame({
      title: "Resident Evil 2 Deluxe Edition",
      type: "expanded_game",
      versionParent: 1,
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
    "Resident Evil 2 Expanded",
    "Resident Evil 2: Extra Chapter",
  ]);
});

test("old search caches cannot hide expanded games and expanded game links resolve", async () => {
  const db = await createTestDb();
  await db
    .insert(searchCache)
    .values({ query: "v2:emerald", gameIds: [], fetchedAt: new Date() });
  const source = createFakeGameSource([
    sourceGame({
      id: 1517,
      title: "Pokémon Emerald Version",
      slug: "pokemon-emerald-version",
      type: "expanded_game",
    }),
    sourceGame({
      id: 2,
      slug: "deluxe-edition",
      type: "expanded_game",
      versionParent: 1517,
    }),
  ]);
  const catalog = createCatalog(db, source);
  expect(await catalog.search("emerald")).toEqual([
    expect.objectContaining({ id: 1517 }),
  ]);
  expect(await catalog.search("emerald")).toEqual([
    expect.objectContaining({ id: 1517 }),
  ]);
  expect(source.searches).toBe(1);
  const fresh = createCatalog(await createTestDb(), source);
  expect(await fresh.findBySlug("pokemon-emerald-version")).toMatchObject({
    id: 1517,
  });
  expect(await fresh.findBySlug("deluxe-edition")).toBeNull();
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

test("tags survive saving and finding a game by slug", async () => {
  const source = createFakeGameSource([
    sourceGame({
      title: "Hades",
      slug: "hades--1",
      tags: ["roguelike", "rpg"],
    }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);
  await catalog.search("hades");
  expect((await catalog.findBySlug("hades--1"))?.tags).toEqual([
    "roguelike",
    "rpg",
  ]);
});

test("older games refresh unknown tags once, retaining local data on source failure", async () => {
  const db = await createTestDb();
  await db.insert(game).values({
    id: 901,
    title: "Old Hades",
    slug: "hades--1",
    genres: [],
    platforms: [],
    syncedAt: new Date(),
  });
  const source = createFakeGameSource([
    sourceGame({
      id: 901,
      title: "Hades",
      slug: "hades--1",
      tags: ["roguelike"],
    }),
  ]);
  const fetchGame = vi
    .spyOn(source, "fetchGame")
    .mockRejectedValueOnce(new Error("Offline"));
  const catalog = createCatalog(db, source);
  expect(await catalog.findBySlug("hades--1")).toMatchObject({
    title: "Old Hades",
    tags: null,
  });
  expect(await catalog.findBySlug("hades--1")).toMatchObject({
    title: "Hades",
    tags: ["roguelike"],
  });
  await catalog.findBySlug("hades--1");
  expect(fetchGame).toHaveBeenCalledTimes(2);
});

test("tag shelves exclude the current game, dedupe and keep six most-rated eligible games without saving them", async () => {
  const db = await createTestDb();
  const games = Array.from({ length: 9 }, (_, i) =>
    sourceGame({
      id: i + 1,
      tags: ["roguelike"],
      popularity: 100 - i,
      coverImageId: "cover",
    }),
  );
  const source = createFakeGameSource([
    ...games,
    games[1],
    sourceGame({
      id: 100,
      tags: ["roguelike"],
      popularity: 200,
      type: "port",
      coverImageId: "cover",
    }),
    ...[
      { type: "dlc_addon" as const },
      { fanMade: true },
      { versionParent: 2 },
      { themes: [42] },
      { coverImageId: null },
      { title: " " },
      { slug: "bad/slug" },
    ].map((overrides, i) =>
      sourceGame({
        id: 110 + i,
        tags: ["roguelike"],
        popularity: 200,
        coverImageId: "cover",
        ...overrides,
      }),
    ),
  ]);
  const catalog = createCatalog(db, source);
  const shelves = await catalog.tagShelves(1, [
    "adventure",
    "indie",
    "action",
    "rpg",
    "roguelike",
    "unknown",
  ]);
  expect(shelves.map((s) => s.tag.slug)).toEqual(["roguelike"]);
  expect(shelves[0].games.map((g) => g.id)).toEqual([2, 3, 4, 5, 6, 7]);
  expect(await db.select().from(game)).toEqual([]);
});

test("tag shelves use vocabulary order, cap at eight and resolve popularity ties by ID", async () => {
  const tags = [
    "fantasy",
    "rpg",
    "greek-mythology",
    "dungeon-crawler",
    "soulslike",
    "roguelike",
    "metroidvania",
    "deck-building",
    "bullet-hell",
    "survival-horror",
  ];
  const source = createFakeGameSource([
    sourceGame({ id: 30, tags, coverImageId: "cover", popularity: 5 }),
    sourceGame({ id: 20, tags, coverImageId: "cover", popularity: 5 }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);
  const shelves = await catalog.tagShelves(1, tags);
  expect(shelves.map((s) => s.tag.slug)).toEqual([
    "roguelike",
    "metroidvania",
    "soulslike",
    "dungeon-crawler",
    "greek-mythology",
    "deck-building",
    "survival-horror",
    "bullet-hell",
  ]);
  expect(shelves[0].games.map((g) => g.id)).toEqual([20, 30]);
  expect(await catalog.tagShelves(1, null)).toEqual([]);
  expect(await catalog.tagShelves(1, [])).toEqual([]);
});

test("a tag source failure propagates to the section's local error boundary", async () => {
  const source = createFakeGameSource([]);
  vi.spyOn(source, "fetchTagGames").mockRejectedValue(new Error("Offline"));
  const catalog = createCatalog(await createTestDb(), source);
  await expect(catalog.tagShelves(1, ["roguelike"])).rejects.toThrow("Offline");
});

test("age ratings and languages are saved, replaced on resync, and an empty list stays distinct from not synced", async () => {
  const rated = sourceGame({
    title: "Hades II",
    slug: "hades-ii",
    ageRatings: [{ board: "ESRB", rating: "T", descriptors: ["Violence"] }],
    languages: [
      { name: "English", voices: true, subtitles: true, interface: true },
    ],
  });
  const unrated = sourceGame({ title: "Hades Demo", slug: "hades-demo" });
  const catalog = createCatalog(
    await createTestDb(),
    createFakeGameSource([rated, unrated]),
  );
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  await catalog.search("hades");

  expect(await catalog.findBySlug("hades-ii")).toMatchObject({
    ageRatings: [{ board: "ESRB", rating: "T", descriptors: ["Violence"] }],
    languages: [
      { name: "English", voices: true, subtitles: true, interface: true },
    ],
  });
  expect(await catalog.findBySlug("hades-demo")).toMatchObject({
    ageRatings: [],
    languages: [],
  });

  rated.ageRatings = [{ board: "PEGI", rating: "12", descriptors: [] }];
  rated.languages = [];
  vi.setSystemTime(new Date("2026-01-02T00:01:00Z"));
  await catalog.search("hades");

  expect(await catalog.findBySlug("hades-ii")).toMatchObject({
    ageRatings: [{ board: "PEGI", rating: "12", descriptors: [] }],
    languages: [],
  });
});

test("a catalog game synced before age ratings and languages existed re-fetches them once", async () => {
  const db = await createTestDb();
  await db.insert(game).values({
    id: 902,
    title: "Celeste",
    slug: "celeste",
    genres: [],
    tags: [],
    platforms: [],
    syncedAt: new Date(),
  });
  const ageRatings = [{ board: "ESRB", rating: "E10+", descriptors: [] }];
  const languages = [
    { name: "English", voices: false, subtitles: true, interface: true },
  ];
  const source = createFakeGameSource([
    sourceGame({
      id: 902,
      title: "Celeste",
      slug: "celeste",
      ageRatings,
      languages,
    }),
  ]);
  const fetchGame = vi.spyOn(source, "fetchGame");
  const catalog = createCatalog(db, source);

  expect(await catalog.findBySlug("celeste")).toMatchObject({
    ageRatings,
    languages,
  });
  await catalog.findBySlug("celeste");
  expect(fetchGame).toHaveBeenCalledTimes(1);
});

test("saving a game again from the source, as a sync does, leaves its Ratings and Community rating alone", async () => {
  const games = [sourceGame({ id: 7, title: "Celeste" })];
  const source = createFakeGameSource(games);
  const db = await createTestDb();
  const catalog = createCatalog(db, source);
  const journal = createJournal(db);
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  await catalog.search("celeste");
  const players = ["a", "b", "c", "d", "e"];
  await db
    .insert(user)
    .values(players.map((id) => ({ id, name: id, email: `${id}@example.com` })));
  for (const [i, id] of players.entries()) {
    await journal.set(id, 7, { status: "played" });
    await journal.setRating(id, 7, i + 6);
  }
  const before = {
    community: await journal.communityRating(7),
    entries: await Promise.all(players.map((id) => journal.entry(id, 7))),
  };
  expect(before.community).toMatchObject({ count: 5, average: 4 });

  // The cached search expires and the source has newer details to save.
  games[0].title = "Celeste (Remastered)";
  vi.setSystemTime(new Date("2026-01-02T01:00:00Z"));
  await catalog.search("celeste");
  expect(source.searches).toBe(2);
  expect((await catalog.findBySlug("game-7"))?.title).toBe(
    "Celeste (Remastered)",
  );

  expect(await journal.communityRating(7)).toEqual(before.community);
  expect(
    await Promise.all(players.map((id) => journal.entry(id, 7))),
  ).toEqual(before.entries);
});
