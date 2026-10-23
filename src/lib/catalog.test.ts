import { afterEach, expect, test, vi } from "vitest";
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
