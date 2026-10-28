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
  source.fetchDiscoveryRanks = async (...args) => {
    const page = await fetchRanks(...args);
    return {
      ...page,
      ranks: [
        { gameId: 999, visits: 100 },
        ...page.ranks,
        { gameId: 3, visits: Number.NaN },
      ],
    };
  };
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
  source.fetchDiscoveryRanks = async () => ({
    ranks: Array.from({ length: 101 }, (_, i) => ({
      gameId: i + 2,
      visits: 50,
    })),
    hasMore: false,
  });
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

test("refresh stops within the first ranked page when both shelves are complete, even with more ranks available", async () => {
  const games = Array.from({ length: 1005 }, (_, i) =>
    sourceGame({
      id: i + 1,
      visits: i >= 1000 ? 100 : 1,
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
    [1001, 1002, 1003, 1004],
    [1001, 1002, 1003, 1004],
  ]);
  expect(ranks).toHaveBeenCalledTimes(1);
  expect(metadata.mock.calls.flatMap(([ids]) => ids)).not.toContain(200);
});

test("exclusion traversal recovers reordered boundary ties and shares completed prefixes across shelves", async () => {
  const games = Array.from({ length: 10 }, (_, i) =>
    sourceGame({
      id: i + 1,
      visits: i === 9 ? 1 : 10,
      coverImageId: "cover",
      firstReleaseDate: new Date(),
    }),
  );
  const source = createFakeGameSource(games);
  let pages = 0;
  source.fetchDiscoveryRanks = async (excludedIds, signal) => {
    signal.throwIfAborted();
    if (++pages > 3) throw new Error("Unnecessary full scan or shelf refetch");
    // An offset into the reordered ties would skip 1 and 2 on the last page.
    const order =
      pages === 1
        ? [9, 8, 7, 6, 5, 4, 3, 2, 1, 10]
        : [6, 5, 4, 3, 9, 8, 7, 1, 2, 10];
    const remaining = order.filter((id) => !excludedIds.includes(id));
    return {
      ranks: remaining
        .slice(0, 4)
        .map((gameId) => ({ gameId, visits: gameId === 10 ? 1 : 10 })),
      hasMore: remaining.length >= 4,
    };
  };
  const catalog = createCatalog(await createTestDb(), source);
  expect(await catalog.refreshDiscovery()).toEqual({ recent: 4, popular: 4 });
  expect(
    (await catalog.discovery()).map((s) => s.games.map((g) => g.id)),
  ).toEqual([
    [1, 2, 3, 4],
    [1, 2, 3, 4],
  ]);
  expect(pages).toBe(3);
});

test("a failed deeper page keeps recent stale while popular publishes the reusable complete prefix", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28"));
  const source = createFakeGameSource([
    sourceGame({
      id: 1,
      visits: 10,
      coverImageId: "cover",
      firstReleaseDate: new Date("2026-10-01"),
    }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);
  await catalog.refreshDiscovery();
  const oldRecent = (await catalog.discovery())[0];
  vi.setSystemTime(new Date("2026-10-29"));
  const candidates = [11, 12, 13, 14, 15].map((id) =>
    sourceGame({
      id,
      coverImageId: id === 15 ? null : "cover",
      firstReleaseDate: id < 14 ? new Date("2026-10-01") : null,
    }),
  );
  let calls = 0;
  source.fetchDiscoveryRanks = async (excludedIds) => {
    calls++;
    if (excludedIds.length)
      throw new Error("Provider unavailable on continuation");
    return {
      hasMore: true,
      ranks: [
        { gameId: 11, visits: 10 },
        { gameId: 12, visits: 9 },
        { gameId: 13, visits: 8 },
        { gameId: 14, visits: 7 },
        { gameId: 15, visits: 6 },
      ],
    };
  };
  source.fetchGames = async (ids) =>
    candidates.filter((g) => ids.includes(g.id));
  expect(await catalog.refreshDiscovery()).toEqual({
    recent: "failed",
    popular: 4,
  });
  const shelves = await catalog.discovery();
  expect(shelves[0]).toEqual(oldRecent);
  expect(shelves[1].games.map((g) => g.id)).toEqual([11, 12, 13, 14]);
  expect(shelves[1].refreshedAt.toISOString()).toBe("2026-10-29T00:00:00.000Z");
  expect(calls).toBe(2);
});
