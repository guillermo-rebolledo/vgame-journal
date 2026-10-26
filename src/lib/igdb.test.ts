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
