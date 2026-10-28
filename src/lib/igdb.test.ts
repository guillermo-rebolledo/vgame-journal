import { afterEach, expect, test, vi } from "vitest";
import { createLimiter, igdbGameSource } from "./igdb";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("a game's platforms include those of its remasters and ports, once each", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.includes("twitch")
          ? { access_token: "t", expires_in: 3600 }
          : [
              {
                id: 1009,
                name: "The Last of Us",
                slug: "the-last-of-us",
                platforms: [{ name: "PlayStation 3" }],
                remasters: [
                  {
                    platforms: [
                      { name: "PlayStation 4" },
                      { name: "PlayStation 3" },
                    ],
                  },
                  {},
                ],
                ports: [{ platforms: [{ name: "PlayStation 5" }] }],
              },
            ],
      ),
    ),
  );

  const game = await igdbGameSource.fetchGame(1009);

  expect(game?.platforms).toEqual([
    "PlayStation 3",
    "PlayStation 4",
    "PlayStation 5",
  ]);
});

test("release date precision follows IGDB's date formats", async () => {
  const dated = (format: string) => ({
    date: 1_790_000_000,
    date_format: { format },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.includes("twitch")
          ? { access_token: "t", expires_in: 3600 }
          : [
              {
                id: 1,
                name: "Game",
                slug: "game",
                release_dates: [
                  dated("YYYYMMDD"),
                  dated("YYYYMM"),
                  dated("YYYYQ3"),
                  dated("YYYY"),
                  { date_format: { format: "TBD" } },
                ],
              },
            ],
      ),
    ),
  );

  const game = await igdbGameSource.fetchGame(1);

  expect(game?.releaseDates.map((d) => d.precision)).toEqual([
    "day",
    "month",
    "quarter",
    "year",
    "tbd",
  ]);
});

test("release dates for a batch of games are paged past IGDB's 500 per request", async () => {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      bodies.push(String(init?.body));
      // 500 dates for game 1, then the last 3 (for game 2) on the next page.
      const page = bodies.length === 1 ? 500 : bodies.length === 2 ? 3 : 0;
      return Response.json(
        Array.from({ length: page }, () => ({
          game: bodies.length === 1 ? 1 : 2,
          date: 1_790_000_000,
          date_format: { format: "YYYYMMDD" },
        })),
      );
    }),
  );

  const dates = await igdbGameSource.fetchReleaseDates([1, 2]);

  expect(dates.get(1)).toHaveLength(500);
  expect(dates.get(2)).toHaveLength(3);
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toMatch(/offset 500;/);
});

test("starts at most 4 requests a second and keeps at most 8 open", async () => {
  vi.useFakeTimers();
  const limit = createLimiter(4, 8);
  let started = 0;
  for (let i = 0; i < 10; i++)
    limit(async () => {
      started++;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    });

  await vi.advanceTimersByTimeAsync(0);
  expect(started).toBe(4);
  await vi.advanceTimersByTimeAsync(1000);
  expect(started).toBe(8);
  await vi.advanceTimersByTimeAsync(3000);
  expect(started).toBe(8); // 8 still open
  await vi.advanceTimersByTimeAsync(1000);
  expect(started).toBe(10);
});

test("Visits pages use ranked exclusions without unsupported filters, offsets or full scans", async () => {
  const rows = Array.from({ length: 503 }, (_, i) => ({
    game_id: 503 - i,
    value: i < 502 ? 10 : 1,
  }));
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      const body = String(init?.body);
      bodies.push(body);
      if (
        /value\s*[<>=]/.test(body) ||
        /offset/.test(body) ||
        /sort [^;]*,/.test(body) ||
        (body.match(/sort /g)?.length ?? 0) !== 1 ||
        !body.includes("sort value desc") ||
        !body.includes("limit 500")
      )
        return new Response("Unsupported traversal", { status: 400 });
      const excluded =
        body
          .match(/game_id != \(([^)]+)\)/)?.[1]
          .split(",")
          .map(Number) ?? [];
      return Response.json(
        rows.filter((r) => !excluded.includes(r.game_id)).slice(0, 500),
      );
    }),
  );
  const signal = new AbortController().signal;
  const first = await igdbGameSource.fetchDiscoveryRanks([], signal);
  expect(first.hasMore).toBe(true);
  expect(first.ranks).toHaveLength(500);
  expect(bodies).toHaveLength(1);
  const second = await igdbGameSource.fetchDiscoveryRanks(
    first.ranks.map((r) => r.gameId),
    signal,
  );
  expect(second).toEqual({
    hasMore: false,
    ranks: [
      { gameId: 3, visits: 10 },
      { gameId: 2, visits: 10 },
      { gameId: 1, visits: 1 },
    ],
  });
  expect(bodies).toHaveLength(2);
});

test("discovery batches metadata within provider limits and preserves eligibility fields and missing records", async () => {
  const sizes: number[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      const body = String(init?.body);
      const ids =
        body
          .match(/where id = \(([^)]+)\)/)?.[1]
          .split(",")
          .map(Number) ?? [];
      sizes.push(ids.length);
      return Response.json(
        ids.includes(501)
          ? []
          : [
              {
                id: 1,
                name: "Game",
                slug: "game",
                first_release_date: 1790000000,
                themes: [42],
                version_parent: 2,
              },
            ],
      );
    }),
  );
  const signal = new AbortController().signal;
  expect(await igdbGameSource.fetchGames([], signal)).toEqual([]);
  const games = await igdbGameSource.fetchGames(
    Array.from({ length: 501 }, (_, i) => i + 1),
    signal,
  );
  expect(sizes).toEqual([500, 1]);
  expect(games).toEqual([
    expect.objectContaining({
      id: 1,
      firstReleaseDate: new Date(1790000000000),
      themes: [42],
      versionParent: 2,
    }),
  ]);
});

test("discovery rank pages propagate provider errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("twitch")
        ? Response.json({ access_token: "t", expires_in: 3600 })
        : new Response("Unavailable", { status: 503 }),
    ),
  );
  await expect(
    igdbGameSource.fetchDiscoveryRanks([1, 2], new AbortController().signal),
  ).rejects.toThrow("503");
});

test("discovery propagates metadata errors and cancellation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("twitch")
        ? Response.json({ access_token: "t", expires_in: 3600 })
        : new Response("Unavailable", { status: 503 }),
    ),
  );
  await expect(
    igdbGameSource.fetchGames([1], new AbortController().signal),
  ).rejects.toThrow("503");
  const controller = new AbortController();
  controller.abort(new DOMException("Timed out", "TimeoutError"));
  await expect(
    igdbGameSource.fetchDiscoveryRanks([], controller.signal),
  ).rejects.toThrow("Timed out");
  await expect(
    igdbGameSource.fetchGames([1], controller.signal),
  ).rejects.toThrow("Timed out");
});

test("recent candidate pages query the inclusive release window and review counts with a stable ID cursor", async () => {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      const body = String(init?.body);
      bodies.push(body);
      if (
        !body.includes("first_release_date >= 1000") ||
        !body.includes("first_release_date <= 2000") ||
        !body.includes("(rating_count >= 10 | aggregated_rating_count >= 3)") ||
        !body.includes("sort id asc") ||
        /offset/.test(body)
      )
        return new Response("Unsupported candidates query", { status: 400 });
      const after = Number(body.match(/id > (\d+)/)?.[1]);
      return Response.json(
        after === 0
          ? Array.from({ length: 500 }, (_, i) => ({
              id: i + 1,
              name: "Game",
              slug: `game-${i + 1}`,
              rating: 75,
              rating_count: 10,
              first_release_date: 1500,
              genres: [{ name: "Indie" }],
            }))
          : [
              {
                id: 501,
                name: "Critic game",
                slug: "critic-game",
                aggregated_rating: 75,
                aggregated_rating_count: 3,
              },
            ],
      );
    }),
  );
  const signal = new AbortController().signal;
  const first = await igdbGameSource.fetchRecentCandidates(
    0,
    new Date(1000000),
    new Date(2000000),
    signal,
  );
  expect(first.hasMore).toBe(true);
  expect(first.games[0]).toMatchObject({
    id: 1,
    userScore: 75,
    userScoreCount: 10,
    genres: ["Indie"],
    firstReleaseDate: new Date(1500000),
  });
  const second = await igdbGameSource.fetchRecentCandidates(
    500,
    new Date(1000000),
    new Date(2000000),
    signal,
  );
  expect(second).toMatchObject({
    hasMore: false,
    games: [{ id: 501, criticScore: 75, criticScoreCount: 3 }],
  });
  expect(bodies).toHaveLength(2);
});

test("candidate Visits lookups batch IDs and paginate using supported ID filters only", async () => {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      const body = String(init?.body);
      bodies.push(body);
      if (
        /value\s*[<>=]/.test(body) ||
        /offset|sort [^;]*,/.test(body) ||
        !body.includes("sort game_id asc") ||
        !body.includes("popularity_type = 1")
      )
        return new Response("Unsupported Visits lookup", { status: 400 });
      const ids =
        body
          .match(/game_id = \(([^)]+)\)/)?.[1]
          .split(",")
          .map(Number) ?? [];
      expect(ids.length).toBeLessThanOrEqual(500);
      const after = Number(body.match(/game_id > (\d+)/)?.[1]);
      return Response.json(
        ids
          .filter((id) => id > after && id !== 501)
          .map((game_id) => ({ game_id, value: 0.002 })),
      );
    }),
  );
  const signal = new AbortController().signal;
  expect(await igdbGameSource.fetchVisits([], signal)).toEqual([]);
  expect(bodies).toHaveLength(0);
  const ranks = await igdbGameSource.fetchVisits(
    [...Array.from({ length: 501 }, (_, i) => i + 1), 1],
    signal,
  );
  expect(ranks).toHaveLength(500);
  expect(ranks[0]).toEqual({ gameId: 1, visits: 0.002 });
  expect(ranks.at(-1)).toEqual({ gameId: 500, visits: 0.002 });
  expect(bodies).toHaveLength(3);
});

test("recent pool and Visits lookup propagate HTTP failures and cancellation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("twitch")
        ? Response.json({ access_token: "t", expires_in: 3600 })
        : new Response("Unavailable", { status: 503 }),
    ),
  );
  const signal = new AbortController().signal;
  await expect(
    igdbGameSource.fetchRecentCandidates(0, new Date(0), new Date(), signal),
  ).rejects.toThrow("503");
  await expect(igdbGameSource.fetchVisits([1], signal)).rejects.toThrow("503");
  const aborted = AbortSignal.abort(
    new DOMException("Timed out", "TimeoutError"),
  );
  await expect(
    igdbGameSource.fetchRecentCandidates(0, new Date(0), new Date(), aborted),
  ).rejects.toThrow("Timed out");
  await expect(igdbGameSource.fetchVisits([1], aborted)).rejects.toThrow(
    "Timed out",
  );
});
