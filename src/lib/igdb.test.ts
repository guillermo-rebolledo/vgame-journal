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

test("discovery retrieves Visits pages and batched metadata, preserving first release and content tags", async () => {
  const requests: { url: string; body: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      requests.push({ url, body: String(init?.body) });
      return Response.json(
        url.endsWith("popularity_primitives")
          ? Array.from({ length: 100 }, (_, i) => ({
              game_id: i + 1,
              value: 100,
            }))
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
  const page = await igdbGameSource.fetchDiscoveryPage(
    null,
    new AbortController().signal,
  );
  expect(page.hasMore).toBe(true);
  expect(page.ranks[0]).toEqual({ gameId: 1, visits: 100 });
  expect(page.games[0]).toMatchObject({
    firstReleaseDate: new Date(1790000000000),
    themes: [42],
    versionParent: 2,
  });
  expect(requests).toHaveLength(3);
  expect(requests[0].body).toContain("popularity_type = 1");
  expect(requests[0].body).toContain("sort value desc");
  expect(requests[1].body).toContain("sort game_id asc");
});

test("discovery returns missing metadata in batches and detects exhaustion", async () => {
  const endpoints: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      endpoints.push(url.split("/").at(-1) ?? "");
      const body = String(init?.body);
      if (url.endsWith("games")) return Response.json([]);
      if (body.includes("game_id > 0;"))
        return Response.json([
          { game_id: 7, value: 2 },
          { game_id: 8, value: 2 },
        ]);
      if (body.includes("value <") || body.includes("game_id > 8;"))
        return Response.json([]);
      return Response.json([{ value: 2 }]);
    }),
  );
  const signal = new AbortController().signal;
  expect(await igdbGameSource.fetchDiscoveryPage(null, signal)).toEqual({
    ranks: [
      { gameId: 7, visits: 2 },
      { gameId: 8, visits: 2 },
    ],
    games: [],
    hasMore: true,
  });
  expect(
    await igdbGameSource.fetchDiscoveryPage({ gameId: 8, visits: 2 }, signal),
  ).toEqual({ ranks: [], games: [], hasMore: false });
  expect(endpoints).toEqual([
    "popularity_primitives",
    "popularity_primitives",
    "games",
    "popularity_primitives",
    "popularity_primitives",
  ]);
});

test("discovery propagates provider errors and cancellation instead of returning successful partial results", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("twitch")
        ? Response.json({ access_token: "t", expires_in: 3600 })
        : new Response("Unavailable", { status: 503 }),
    ),
  );
  await expect(
    igdbGameSource.fetchDiscoveryPage(null, new AbortController().signal),
  ).rejects.toThrow("503");
  const controller = new AbortController();
  controller.abort(new DOMException("Timed out", "TimeoutError"));
  await expect(
    igdbGameSource.fetchDiscoveryPage(null, controller.signal),
  ).rejects.toThrow("Timed out");
});

test("Visits pagination traverses whole tie groups by game ID using decimal value filters", async () => {
  const rows = [
    { game_id: 500, value: 20 },
    ...Array.from({ length: 205 }, (_, i) => ({ game_id: 205 - i, value: 10 })),
    { game_id: 600, value: 0.5 },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      const body = String(init?.body);
      if (url.endsWith("games")) {
        const ids =
          body
            .match(/where id = \(([^)]+)\)/)?.[1]
            .split(",")
            .map(Number) ?? [];
        return Response.json(
          ids.map((id) => ({ id, name: `Game ${id}`, slug: `game-${id}` })),
        );
      }
      // Model IGDB's Decimal type check and documented single-field sorting.
      if (
        /value\s*[<>=]+\s*\d+(?=\s*[;&])/.test(body) ||
        /sort [^;]*,/.test(body)
      ) {
        return new Response("Unsupported query", { status: 400 });
      }
      let filtered = [...rows];
      for (const match of body.matchAll(
        /(value|game_id)\s*([<>=])\s*([\d.]+)/g,
      )) {
        const field = match[1] as "value" | "game_id";
        const value = Number(match[3]);
        filtered = filtered.filter((row) =>
          match[2] === "="
            ? row[field] === value
            : match[2] === ">"
              ? row[field] > value
              : row[field] < value,
        );
      }
      if (body.includes("sort game_id asc"))
        filtered.sort((a, b) => a.game_id - b.game_id);
      else filtered.sort((a, b) => b.value - a.value);
      const offset = Number(body.match(/offset (\d+)/)?.[1] ?? 0);
      const limit = Number(body.match(/limit (\d+)/)?.[1] ?? 10);
      return Response.json(filtered.slice(offset, offset + limit));
    }),
  );
  const ranks: { gameId: number; visits: number }[] = [];
  let cursor: { gameId: number; visits: number } | null = null;
  for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
    const page = await igdbGameSource.fetchDiscoveryPage(
      cursor,
      new AbortController().signal,
    );
    ranks.push(...page.ranks);
    expect(page.games.map((game) => game.id)).toEqual(
      page.ranks.map((rank) => rank.gameId),
    );
    if (!page.hasMore) break;
    cursor = page.ranks.at(-1) ?? null;
  }
  expect(ranks.map((rank) => rank.gameId)).toEqual([
    500,
    ...Array.from({ length: 205 }, (_, i) => i + 1),
    600,
  ]);
});
