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

test("Visits traversal uses supported game-ID cursors across pages without value filters", async () => {
  const rows = [
    ...Array.from({ length: 501 }, (_, i) => ({ game_id: i + 1, value: 10 })),
    { game_id: 900, value: 50 },
    { game_id: 901, value: 0 },
  ];
  const cursors: number[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      const body = String(init?.body);
      // These operations are rejected by the live API, even for decimal literals.
      if (
        /value\s*[<>=]/.test(body) ||
        /sort [^;]*,/.test(body) ||
        (body.match(/sort /g)?.length ?? 0) > 1
      )
        return new Response("Invalid filter operation", { status: 400 });
      const after = Number(body.match(/game_id > (\d+)/)?.[1]);
      if (
        !Number.isFinite(after) ||
        !body.includes("sort game_id asc") ||
        !body.includes("limit 500")
      )
        return new Response("Unsupported traversal", { status: 400 });
      cursors.push(after);
      return Response.json(rows.filter((r) => r.game_id > after).slice(0, 500));
    }),
  );
  const ranks = await igdbGameSource.fetchDiscoveryRanks(
    new AbortController().signal,
  );
  expect(ranks).toHaveLength(503);
  expect(ranks[0]).toEqual({ gameId: 1, visits: 10 });
  expect(ranks.at(-2)).toEqual({ gameId: 900, visits: 50 });
  expect(cursors).toEqual([0, 500]);
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

test("a failed later rank page rejects the scan rather than returning partial ranks", async () => {
  let pages = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      if (++pages === 1)
        return Response.json(
          Array.from({ length: 500 }, (_, i) => ({
            game_id: i + 1,
            value: 10,
          })),
        );
      return new Response("Unavailable", { status: 503 });
    }),
  );
  await expect(
    igdbGameSource.fetchDiscoveryRanks(new AbortController().signal),
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
    igdbGameSource.fetchDiscoveryRanks(controller.signal),
  ).rejects.toThrow("Timed out");
  await expect(
    igdbGameSource.fetchGames([1], controller.signal),
  ).rejects.toThrow("Timed out");
});
