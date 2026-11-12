import { afterEach, expect, test, vi } from "vitest";
import { createLimiter, igdbGameSource } from "./igdb";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test.each([
  "pokemon emerald",
  "pokemon soul silver",
])("search finds %s through the eligible provider query", async (query) => {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      const body = String(init?.body);
      bodies.push(body);
      expect(body).toContain("version_parent = null");
      expect(body).toContain("keywords != (2004,24124,27216,25522)");
      // Live IGDB classifies Emerald as expanded_game and matches SoulSilver as one word.
      return Response.json(
        query.includes("emerald")
          ? body.includes("game_type = (0,4,8,10)")
            ? [
                {
                  id: 1517,
                  name: "Pokémon Emerald Version",
                  slug: "pokemon-emerald-version",
                  game_type: 10,
                },
              ]
            : []
          : body.includes('search "pokemon soulsilver";')
            ? [
                {
                  id: 1520,
                  name: "Pokémon SoulSilver Version",
                  slug: "pokemon-soulsilver-version",
                  game_type: 8,
                },
              ]
            : [],
      );
    }),
  );
  expect(await igdbGameSource.search(query)).toEqual([
    expect.objectContaining({ id: query.includes("emerald") ? 1517 : 1520 }),
  ]);
  expect(bodies).toHaveLength(query.includes("emerald") ? 1 : 2);
});

test("spacing fallback tries at most three adjacent joins, from the end", async () => {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      bodies.push(String(init?.body));
      return Response.json([]);
    }),
  );
  expect(await igdbGameSource.search("one two three four five six")).toEqual(
    [],
  );
  expect(bodies.map((body) => body.match(/^search "([^"]*)";/)?.[1])).toEqual([
    "one two three four five six",
    "one two three four fivesix",
    "one two three fourfive six",
    "one two threefour five six",
  ]);
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

test("age ratings and languages are asked for and mapped from IGDB's shape", async () => {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      bodies.push(String(init?.body));
      // Recorded from IGDB (Hades II), trimmed.
      return Response.json([
        {
          id: 1,
          name: "Hades II",
          slug: "hades-ii",
          age_ratings: [
            {
              organization: { name: "ESRB" },
              rating_category: { rating: "T" },
              rating_content_descriptions: [
                { description: "Blood" },
                { description: "Violence" },
              ],
            },
            {
              organization: { name: "CLASS_IND" },
              rating_category: { rating: "14" },
              rating_content_descriptions: [
                { description: "Violência (Violence)" },
                { description: "Conteúdo Sexual (Sexual Content)" },
              ],
            },
            {
              organization: { name: "ACB" },
              rating_category: { rating: "M" },
            },
            {
              organization: { name: "GRAC" },
              rating_category: { rating: "TESTING" },
            },
          ],
          language_supports: [
            {
              language: { name: "English" },
              language_support_type: { name: "Audio" },
            },
            {
              language: { name: "English" },
              language_support_type: { name: "Subtitles" },
            },
            {
              language: { name: "French" },
              language_support_type: { name: "Interface" },
            },
          ],
        },
      ]);
    }),
  );

  const game = await igdbGameSource.fetchGame(1);

  expect(bodies[0]).toContain("age_ratings.organization.name");
  expect(bodies[0]).toContain("age_ratings.rating_category.rating");
  expect(bodies[0]).toContain(
    "age_ratings.rating_content_descriptions.description",
  );
  expect(bodies[0]).toContain("language_supports.language.name");
  expect(bodies[0]).toContain("language_supports.language_support_type.name");
  expect(game?.ageRatings).toEqual([
    { board: "ESRB", rating: "T", descriptors: ["Blood", "Violence"] },
    {
      board: "CLASS_IND",
      rating: "14",
      descriptors: ["Violence", "Sexual Content"],
    },
    { board: "ACB", rating: "M", descriptors: [] },
  ]);
  expect(game?.languages).toEqual([
    { name: "English", voices: true, subtitles: true, interface: false },
    { name: "French", voices: false, subtitles: false, interface: true },
  ]);
});

test("a game without age ratings or languages maps to empty lists", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.includes("twitch")
          ? { access_token: "t", expires_in: 3600 }
          : [{ id: 1, name: "Game", slug: "game" }],
      ),
    ),
  );

  const game = await igdbGameSource.fetchGame(1);

  expect(game?.ageRatings).toEqual([]);
  expect(game?.languages).toEqual([]);
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
  ).rejects.toMatchObject({ code: "unavailable" });
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
  ).rejects.toMatchObject({ code: "unavailable" });
  const controller = new AbortController();
  controller.abort(new DOMException("Timed out", "TimeoutError"));
  await expect(
    igdbGameSource.fetchDiscoveryRanks([], controller.signal),
  ).rejects.toThrow("Timed out");
  await expect(
    igdbGameSource.fetchGames([1], controller.signal),
  ).rejects.toThrow("Timed out");
});

test("recent candidate pages query the inclusive release window and eligibility without review gates", async () => {
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
        /rating_count\s*>=/.test(body) ||
        !body.includes("game_type = (0,4,8,10)") ||
        !body.includes("cover != null") ||
        !body.includes("version_parent = null") ||
        !body.includes("keywords != (2004,24124,27216,25522)") ||
        !body.includes("themes != (42)") ||
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
  ).rejects.toMatchObject({ code: "unavailable" });
  await expect(igdbGameSource.fetchVisits([1], signal)).rejects.toMatchObject({
    code: "unavailable",
  });
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

test("game tags map IDs in vocabulary order and merge roguelike variants without exposing unknown or Erotic tags", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.includes("twitch")
          ? { access_token: "t", expires_in: 3600 }
          : [
              {
                id: 113112,
                name: "Hades",
                slug: "hades--1",
                genres: [
                  { id: 12, name: "Role-playing (RPG)" },
                  { id: 25, name: "Hack and slash/Beat 'em up" },
                ],
                themes: [42, 17],
                player_perspectives: [3],
                keywords: [17292, 416, 2228, 35, 999999],
              },
            ],
      ),
    ),
  );
  const game = await igdbGameSource.fetchGame(113112);
  expect(game?.tags).toEqual([
    "roguelike",
    "dungeon-crawler",
    "greek-mythology",
    "rpg",
    "hack-and-slash",
    "fantasy",
    "isometric",
  ]);
  expect(game?.genres).toEqual([
    "Role-playing (RPG)",
    "Hack and slash/Beat 'em up",
  ]);
});

test("tag games query merged keywords and source eligibility, ranked by rating count with ID ties", async () => {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      bodies.push(String(init.body));
      return Response.json([
        {
          id: 3,
          name: "Third",
          slug: "third",
          total_rating_count: 20,
          hypes: 1000,
        },
        { id: 2, name: "Second", slug: "second", total_rating_count: 20 },
        { id: 1, name: "First", slug: "first", total_rating_count: 30 },
      ]);
    }),
  );
  const games = await igdbGameSource.fetchTagGames(
    "roguelike",
    24,
    AbortSignal.timeout(1000),
  );
  expect(games.map((g) => g.id)).toEqual([1, 2, 3]);
  expect(games.map((g) => g.popularity)).toEqual([30, 20, 20]);
  expect(bodies[0]).toContain("keywords = (416,17292)");
  for (const filter of [
    "game_type = (0,4,8,10)",
    "version_parent = null",
    "keywords != (2004,24124,27216,25522)",
    "themes != (42)",
    "cover != null",
    "sort total_rating_count desc",
  ])
    expect(bodies[0]).toContain(filter);
  for (const [slug, field] of [
    ["rpg", "genres = (12)"],
    ["fantasy", "themes = (17)"],
    ["isometric", "player_perspectives = (3)"],
  ]) {
    await igdbGameSource.fetchTagGames(slug, 24, AbortSignal.timeout(1000));
    expect(bodies.at(-1)).toContain(field);
  }
  const count = bodies.length;
  expect(
    await igdbGameSource.fetchTagGames(
      'unknown";',
      24,
      AbortSignal.timeout(1000),
    ),
  ).toEqual([]);
  expect(bodies).toHaveLength(count);
});

test("tag shelves propagate provider failures and cancellation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("twitch")
        ? Response.json({ access_token: "t", expires_in: 3600 })
        : new Response("Unavailable", { status: 503 }),
    ),
  );
  await expect(
    igdbGameSource.fetchTagGames("roguelike", 24, new AbortController().signal),
  ).rejects.toMatchObject({ code: "unavailable" });
  await expect(
    igdbGameSource.fetchTagGames(
      "roguelike",
      24,
      AbortSignal.abort(new Error("Cancelled")),
    ),
  ).rejects.toThrow("Cancelled");
});

test.each([
  "60",
  new Date(Date.now() + 60_000).toUTCString(),
])("throttling respects retry-after %s without search fallbacks", async (retryAfter) => {
  vi.resetModules();
  const source = (await import("./igdb")).igdbGameSource;
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const fetcher = vi.fn(async (url: string) =>
    url.includes("twitch")
      ? Response.json({ access_token: "t", expires_in: 3600 })
      : Response.json(
          {},
          { status: 429, headers: { "retry-after": retryAfter } },
        ),
  );
  vi.stubGlobal("fetch", fetcher);
  try {
    await expect(source.search("private search")).rejects.toMatchObject({
      code: "rate_limited",
    });
    await expect(source.search("private search")).rejects.toMatchObject({
      code: "rate_limited",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain("private search");
  } finally {
    log.mockRestore();
  }
});

test("malformed provider search fails rather than claiming no results", async () => {
  vi.resetModules();
  const source = (await import("./igdb")).igdbGameSource;
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.includes("twitch")
          ? { access_token: "t", expires_in: 3600 }
          : { message: "private" },
      ),
    ),
  );
  try {
    await expect(source.search("query")).rejects.toMatchObject({
      code: "invalid_response",
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"code":"invalid_response"'),
    );
  } finally {
    log.mockRestore();
  }
});

test("a search deadline removes queued work before it can reach the provider", async () => {
  vi.resetModules();
  const source = (await import("./igdb")).igdbGameSource;
  const controller = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const fetcher = vi.fn(async (url: string) =>
    Response.json(
      url.includes("twitch") ? { access_token: "t", expires_in: 3600 } : [],
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  try {
    // The first search consumes the instance's four starts with spelling fallbacks.
    await source.search("one two three four");
    const queued = source.search("another");
    const assertion = expect(queued).rejects.toMatchObject({ code: "timeout" });
    controller.abort(new DOMException("private timeout", "TimeoutError"));
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(5);
  } finally {
    vi.restoreAllMocks();
    log.mockRestore();
  }
});

test("release-date pagination shares one overall deadline", async () => {
  vi.resetModules();
  const source = (await import("./igdb")).igdbGameSource;
  const deadlines: AbortController[] = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
    const controller = new AbortController();
    deadlines.push(controller);
    return controller.signal;
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  let pages = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      pages++;
      if (pages > 1) return Response.json([]);
      deadlines[0].abort(new DOMException("deadline", "TimeoutError"));
      return Response.json(Array.from({ length: 500 }, () => ({ game: 1 })));
    }),
  );
  try {
    await expect(source.fetchReleaseDates([1])).rejects.toMatchObject({
      code: "timeout",
    });
    expect(pages).toBe(1);
  } finally {
    vi.restoreAllMocks();
  }
});

test("Steam mapping batches quoted appids and cursors through duplicate uid pages", async () => {
  vi.resetModules();
  const source = (await import("./igdb")).igdbGameSource;
  const queries: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      const query = String(init?.body);
      queries.push(query);
      expect(url).toContain("external_games");
      expect(query).toContain("external_game_source = 1");
      expect(query).not.toContain("category =");
      if (queries.length === 1)
        return Response.json(
          Array.from({ length: 500 }, (_, i) => ({
            id: i + 1,
            uid: "1",
            game: { id: 10, game_type: 9, parent_game: 2 },
          })),
        );
      return Response.json(
        queries.length === 2
          ? [{ id: 501, uid: "1", game: { id: 10, version_parent: 2 } }]
          : [],
      );
    }),
  );
  const rows = await source.mapSteamApps(
    Array.from({ length: 501 }, (_, i) => i + 1),
    new AbortController().signal,
  );
  expect(queries).toHaveLength(3);
  expect(queries[0]).toContain('uid = ("1","2",');
  expect(queries[1]).toContain("id > 500");
  expect(queries[2]).toContain('uid = ("501")');
  expect(rows[0]).toMatchObject({
    appid: 1,
    gameId: 10,
    type: "remaster",
    parentGame: 2,
  });
});

test("an IGDB retry timer firing early still waits out the 429 window", async () => {
  vi.resetModules();
  const source = (await import("./igdb")).igdbGameSource;
  const realSetTimeout = setTimeout;
  vi.stubGlobal("setTimeout", (run: () => void, ms = 0) =>
    realSetTimeout(run, Math.max(0, ms - 5)),
  );
  let requests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      requests++;
      return requests === 1
        ? new Response(null, { status: 429, headers: { "retry-after": "0" } })
        : Response.json([{ id: 1, uid: "620", game: { id: 2, game_type: 0 } }]);
    }),
  );
  await expect(
    source.mapSteamApps([620], new AbortController().signal),
  ).resolves.toHaveLength(1);
  expect(requests).toBe(2);
});

test("short IGDB 429 retries once and returns the mapped game", async () => {
  vi.resetModules();
  const source = (await import("./igdb")).igdbGameSource;
  let requests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      requests++;
      return requests === 1
        ? new Response(null, { status: 429, headers: { "retry-after": "0" } })
        : Response.json([{ id: 1, uid: "620", game: { id: 2, game_type: 0 } }]);
    }),
  );
  expect(
    await source.mapSteamApps([620], new AbortController().signal),
  ).toEqual([
    {
      appid: 620,
      gameId: 2,
      type: "main_game",
      versionParent: undefined,
      parentGame: undefined,
    },
  ]);
  expect(requests).toBe(2);
});

test("Play next retrieves relationships, released version dates and most-rated pages without hype", async () => {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("twitch"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      bodies.push(String(init?.body));
      return Response.json([
        {
          id: 1,
          name: "Base",
          slug: "base",
          similar_games: [2],
          collections: [3],
          franchises: [4],
          genres: [{ id: 5, name: "Adventure" }],
          themes: [6],
          player_perspectives: [7],
          game_modes: [8],
          total_rating_count: 10,
          hypes: 900,
          platforms: [{ name: "PC" }],
          ports: [
            {
              platforms: [{ name: "Switch" }],
              release_dates: [
                { date: 1893456000, platform: { name: "Switch" } },
              ],
            },
          ],
          release_dates: [{ date: 1577836800, platform: { name: "PC" } }],
        },
      ]);
    }),
  );
  const signal = new AbortController().signal;
  const seeds = await igdbGameSource.fetchRecommendationSeeds([1], signal);
  expect(seeds[0]).toMatchObject({
    similar: [2],
    series: [3],
    franchises: [4],
    genres: [5],
    themes: [6],
    perspectives: [7],
    modes: [8],
  });
  expect(seeds[0].game.popularity).toBe(10);
  expect(seeds[0].game.releaseDates.map((date) => date.platform)).toEqual([
    "PC",
    "Switch",
  ]);
  const result = await igdbGameSource.fetchRecommendationPage(
    {
      platform: "Switch",
      genre: "Adventure",
      popular: false,
      similar: [2],
      series: [3],
      franchises: [4],
      genres: [5],
      themes: [6],
      perspectives: [7],
      modes: [8],
    },
    1,
    signal,
  );
  expect(result.games[0].game.platforms).toEqual(["PC", "Switch"]);
  expect(bodies[1]).toContain('ports.platforms.name = "Switch"');
  expect(bodies[1]).toContain('remasters.platforms.name = "Switch"');
  expect(bodies[1]).toContain('genres.name = "Adventure"');
  expect(bodies[1]).toContain(
    "sort total_rating_count desc; limit 100; offset 100;",
  );
  expect(bodies[1]).toContain(
    "id = (2) | collections = (3) | franchises = (4) | genres = (5)",
  );
  expect(bodies[1]).toContain("ports.release_dates.date");
});
