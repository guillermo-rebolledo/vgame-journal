import { afterEach, expect, test, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { createFakeGameSource, sourceGame } from "@/test/fake-game-source";
import { createCatalog } from "./catalog";
import type { SourceGame } from "./game-source";

afterEach(() => vi.useRealTimers());

test("discovery publishes ranked canonical games that resolve locally and survive a new Catalog instance", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
  const games = [5, 3, 2, 1, 4].map((id) =>
    sourceGame({
      id,
      coverImageId: "cover",
      firstReleaseDate: new Date("2026-10-01"),
      visits: 10,
    }),
  );
  const source = createFakeGameSource(games);
  const db = await createTestDb();
  const catalog = createCatalog(db, source);
  expect(await catalog.discovery()).toEqual([]);
  await catalog.refreshDiscovery();
  const shelves = await catalog.discovery();
  expect(shelves.map((s) => [s.key, s.games.map((g) => g.id)])).toEqual([
    ["recent", [1, 2, 3, 4]],
    ["popular", [1, 2, 3, 4]],
  ]);
  games.splice(0);
  const reopened = createCatalog(db, createFakeGameSource([]));
  expect(await reopened.discovery()).toEqual(shelves);
  expect(await reopened.findBySlug("game-1")).toMatchObject({ id: 1 });
});

test("discovery pages past excluded records and duplicate IDs, breaking tied ranks by canonical ID", async () => {
  const invalid = [
    { type: "port" },
    { type: "remaster" },
    { type: "bundle" },
    { type: "expanded_game" },
    { type: "dlc_addon" },
    { fanMade: true },
    { themes: [42] },
    { versionParent: 99 },
    { title: " " },
    { slug: "" },
    { coverImageId: null },
    { visits: 0 },
  ] satisfies (Partial<SourceGame> & { visits?: number })[];
  const games = Array.from({ length: 110 }, (_, i) =>
    sourceGame({
      id: i + 100,
      coverImageId: "cover",
      visits: 100,
      ...invalid[i % invalid.length],
    }),
  );
  games.push(
    ...[5, 4, 3, 2, 1, 1].map((id) =>
      sourceGame({
        id,
        visits: 10,
        coverImageId: "cover",
        type: id === 1 ? "remake" : "standalone_expansion",
      }),
    ),
  );
  const catalog = createCatalog(
    await createTestDb(),
    createFakeGameSource(games),
  );
  await catalog.refreshDiscovery();
  expect(
    (await catalog.discovery()).map((s) => [s.key, s.games.map((g) => g.id)]),
  ).toEqual([["popular", [1, 2, 3, 4]]]);
});

test("Recently released uses inclusive worldwide first-release timestamps, then ages stale selections out", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
  const dates = [
    "2026-07-30T12:00:00Z",
    "2026-10-28T12:00:00Z",
    "2026-07-30T11:59:59Z",
    "2026-10-28T12:00:01Z",
    null,
    "2018-01-25T00:00:00Z",
  ];
  const games = dates.map((date, i) =>
    sourceGame({
      id: i + 1,
      visits: 100 - i,
      coverImageId: "cover",
      firstReleaseDate: date ? new Date(date) : null,
      // A later platform release must not make an old game recent.
      releaseDates: [
        {
          date: new Date("2026-10-01"),
          platform: "PC",
          region: "worldwide",
          precision: "day",
          status: null,
        },
      ],
    }),
  );
  const catalog = createCatalog(
    await createTestDb(),
    createFakeGameSource(games),
  );
  await catalog.refreshDiscovery();
  expect(
    (await catalog.discovery()).map((s) => [s.key, s.games.map((g) => g.id)]),
  ).toEqual([
    ["recent", [1, 2]],
    ["popular", [1, 2, 3, 4]],
  ]);
  vi.setSystemTime(new Date("2026-10-28T12:00:01Z"));
  const shelves = await catalog.discovery();
  expect(shelves[0].games.map((g) => g.id)).toEqual([2]);
  expect(shelves[0].refreshedAt.toISOString()).toBe("2026-10-28T12:00:00.000Z");
  vi.setSystemTime(new Date("2027-02-01"));
  expect((await catalog.discovery()).map((s) => s.key)).toEqual(["popular"]);
});

test("independent failures and interruptions preserve IDs and successful timestamps; successful empty results clear a shelf", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28"));
  const games = [
    sourceGame({
      id: 1,
      visits: 10,
      coverImageId: "cover",
      firstReleaseDate: new Date("2026-10-01"),
    }),
  ];
  const source = createFakeGameSource(games);
  const catalog = createCatalog(await createTestDb(), source);
  await catalog.refreshDiscovery();
  const before = await catalog.discovery();
  vi.setSystemTime(new Date("2026-10-29"));
  const fetchRanks = source.fetchDiscoveryRanks;
  let attempts = 0;
  source.fetchDiscoveryRanks = async (...args) => {
    if (++attempts === 1) throw new Error("Provider unavailable");
    return fetchRanks(...args);
  };
  expect(await catalog.refreshDiscovery()).toEqual({
    recent: "failed",
    popular: 1,
  });
  const after = await catalog.discovery();
  expect(after[0]).toEqual(before[0]);
  expect(after[1].refreshedAt.toISOString()).toBe("2026-10-29T00:00:00.000Z");
  const controller = new AbortController();
  source.fetchDiscoveryRanks = async (...args) => {
    const ranks = await fetchRanks(...args);
    controller.abort(new DOMException("Timed out", "TimeoutError"));
    return ranks;
  };
  await catalog.refreshDiscovery(controller.signal);
  expect(await catalog.discovery()).toEqual(after);
  source.fetchDiscoveryRanks = fetchRanks;
  games.splice(0);
  expect(await catalog.refreshDiscovery()).toEqual({ recent: 0, popular: 0 });
  expect(await catalog.discovery()).toEqual([]);
});

test("scheduled refresh lease prevents overlapping instances and immediate retry storms", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28"));
  const db = await createTestDb();
  const source = createFakeGameSource([]);
  const one = createCatalog(db, source);
  const two = createCatalog(db, source);
  expect(await one.claimScheduledRefresh()).toBe(true);
  expect(await two.claimScheduledRefresh()).toBe(false);
  vi.setSystemTime(new Date("2026-10-28T00:05:00Z"));
  expect(await two.claimScheduledRefresh()).toBe(true);
});

test("ties spanning pages prefer lower IDs, while Visits ranking ignores search popularity", async () => {
  const games = Array.from({ length: 102 }, (_, i) =>
    sourceGame({
      id: 102 - i,
      visits: 10,
      popularity: i === 0 ? 999999 : 0,
      coverImageId: "cover",
    }),
  );
  const source = createFakeGameSource(games);
  const catalog = createCatalog(await createTestDb(), source);
  await catalog.refreshDiscovery();
  expect((await catalog.discovery())[0].games.map((g) => g.id)).toEqual([
    1, 2, 3, 4,
  ]);
});

test("successful replacements and short results publish independently of unavailable metadata and failed rankings", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28"));
  const games = [1, 2].map((id) =>
    sourceGame({
      id,
      coverImageId: "cover",
      visits: 3 - id,
      firstReleaseDate: new Date("2026-10-01"),
    }),
  );
  const source = createFakeGameSource(games);
  const db = await createTestDb();
  const catalog = createCatalog(db, source);
  await catalog.refreshDiscovery();
  const oldPopular = (await catalog.discovery())[1];
  vi.setSystemTime(new Date("2026-10-29"));
  games.splice(
    0,
    2,
    sourceGame({
      id: 3,
      coverImageId: "cover",
      visits: 50,
      firstReleaseDate: new Date("2026-10-01"),
    }),
  );
  const fetch = source.fetchGames;
  let call = 0;
  source.fetchGames = async (...args) => {
    if (++call === 2) throw new DOMException("Timed out", "TimeoutError");
    return fetch(...args);
  };
  const fetchRanks = source.fetchDiscoveryRanks;
  source.fetchDiscoveryRanks = async (...args) => [
    { gameId: 999, visits: 100 },
    ...(await fetchRanks(...args)),
    { gameId: 3, visits: Number.NaN },
  ];
  expect(await catalog.refreshDiscovery()).toEqual({
    recent: 1,
    popular: "failed",
  });
  const shelves = await catalog.discovery();
  expect(shelves[0].games.map((g) => g.id)).toEqual([3]);
  expect(shelves[0].refreshedAt.toISOString()).toBe("2026-10-29T00:00:00.000Z");
  expect(shelves[1]).toEqual(oldPopular);
  source.fetchDiscoveryRanks = async () => {
    throw new Error("Home must never fetch live discovery");
  };
  source.fetchBySlug = async () => {
    throw new Error("Selected games must resolve locally");
  };
  expect(await createCatalog(db, source).discovery()).toEqual(shelves);
  expect(await catalog.findBySlug("game-3")).toMatchObject({ id: 3 });
});

test("a hung or interrupted metadata batch cannot publish an incomplete replacement", async () => {
  const games = [sourceGame({ id: 1, coverImageId: "cover", visits: 10 })];
  const source = createFakeGameSource(games);
  const catalog = createCatalog(await createTestDb(), source);
  await catalog.refreshDiscovery();
  const before = await catalog.discovery();
  const controller = new AbortController();
  source.fetchDiscoveryRanks = async () =>
    Array.from({ length: 101 }, (_, i) => ({ gameId: i + 2, visits: 50 }));
  source.fetchGames = async (ids) => {
    if (ids[0] === 2) return [sourceGame({ id: 2, coverImageId: "cover" })];
    // Simulate a provider that ignores the cancellation signal after partial candidates.
    controller.abort(new DOMException("Timed out", "TimeoutError"));
    return new Promise(() => {});
  };
  expect(await catalog.refreshDiscovery(controller.signal)).toEqual({
    recent: "failed",
    popular: "failed",
  });
  expect(await catalog.discovery()).toEqual(before);
});

test("discovery with omitted dates preserves known Catalog release dates", async () => {
  const known = {
    date: new Date("2027-01-15"),
    platform: "PC",
    region: "worldwide",
    precision: "day" as const,
    status: null,
  };
  const games = [
    sourceGame({
      id: 1,
      coverImageId: "cover",
      visits: 10,
      firstReleaseDate: new Date(),
      releaseDates: [known],
    }),
  ];
  const catalog = createCatalog(
    await createTestDb(),
    createFakeGameSource(games),
  );
  await catalog.findBySlug("game-1");
  games[0].releaseDates = [];
  await catalog.refreshDiscovery();
  expect((await catalog.findBySlug("game-1"))?.releaseDates).toEqual([
    expect.objectContaining(known),
  ]);
  games[0].releaseDates = [{ ...known, date: new Date("2027-02-20") }];
  await catalog.refreshDiscovery();
  expect((await catalog.findBySlug("game-1"))?.releaseDates).toEqual([
    expect.objectContaining({ ...known, date: new Date("2027-02-20") }),
  ]);
});

test("refresh scans ranks once, orders late high Visits and ties locally, and only fetches candidate metadata", async () => {
  const games = Array.from({ length: 205 }, (_, i) =>
    sourceGame({
      id: i + 1,
      visits: i >= 200 ? 100 : 1,
      coverImageId: "cover",
      firstReleaseDate: new Date(),
    }),
  );
  const source = createFakeGameSource(games);
  const ranks = vi.spyOn(source, "fetchDiscoveryRanks");
  const metadata = vi.spyOn(source, "fetchGames");
  const catalog = createCatalog(await createTestDb(), source);
  expect(await catalog.refreshDiscovery()).toEqual({ recent: 4, popular: 4 });
  expect(
    (await catalog.discovery()).map((s) => s.games.map((g) => g.id)),
  ).toEqual([
    [201, 202, 203, 204],
    [201, 202, 203, 204],
  ]);
  expect(ranks).toHaveBeenCalledTimes(1);
  expect(metadata.mock.calls.flatMap(([ids]) => ids)).not.toContain(200);
});
