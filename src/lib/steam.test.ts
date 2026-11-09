import { afterEach, expect, test, vi } from "vitest";
import { readSteamGames } from "./steam";

afterEach(() => vi.unstubAllGlobals());
test("Steam distinguishes hidden Game details from an empty account and keeps the key out of URLs", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ response: {} }))
    .mockResolvedValueOnce(Response.json({ response: { game_count: 0 } }));
  vi.stubGlobal("fetch", fetcher);
  expect(await readSteamGames("76561198000000000", "secret")).toEqual({
    kind: "hidden",
  });
  expect(await readSteamGames("76561198000000000", "secret")).toEqual({
    kind: "empty",
  });
  expect(String(fetcher.mock.calls[0][0])).not.toContain("secret");
  expect(fetcher.mock.calls[0][1].headers["x-webapi-key"]).toBe("secret");
});

test("Steam includes played free games, excludes family games and validates incomplete responses", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        response: {
          game_count: 2,
          games: [
            {
              appid: 1,
              name: "Free game",
              playtime_forever: 50,
              rtime_last_played: 60,
            },
            { appid: 2, name: "Shared", family_shared: true },
          ],
        },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ response: { game_count: 1, games: [] } }),
    )
    .mockResolvedValueOnce(Response.json({ response: { game_count: 10_001 } }));
  vi.stubGlobal("fetch", fetcher);
  expect(await readSteamGames("76561198000000000", "key")).toEqual({
    kind: "games",
    games: [{ appid: 1, name: "Free game", playtime: 50, lastPlayed: 60 }],
  });
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.searchParams.get("include_played_free_games")).toBe("true");
  expect(url.searchParams.has("include_family_licenses")).toBe(false);
  await expect(readSteamGames("76561198000000000", "key")).rejects.toThrow();
  expect(await readSteamGames("76561198000000000", "key")).toEqual({
    kind: "too_many",
  });
});
