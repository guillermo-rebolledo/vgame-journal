/** Transient Steam data: never persisted or used to invent Playthroughs. */
export type SteamGame = {
  appid: number;
  name: string;
  playtime: number;
  lastPlayed: number;
};
export const STEAM_IMPORT_LIMIT = 10_000;
export type SteamRead =
  | { kind: "games"; games: SteamGame[] }
  | { kind: "hidden" | "empty" | "too_many" };

export async function readSteamGames(
  steamId: string,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<SteamRead> {
  const url = new URL(
    "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/",
  );
  url.search = new URLSearchParams({
    steamid: steamId,
    include_appinfo: "true",
    include_played_free_games: "true",
  }).toString();
  const response = await fetcher(url, {
    headers: { "x-webapi-key": key },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Steam unavailable");
  const data = (await response.json())?.response;
  if (!data || typeof data !== "object")
    throw new Error("Invalid Steam response");
  if (data.game_count === undefined) return { kind: "hidden" };
  if (!Number.isSafeInteger(data.game_count) || data.game_count < 0)
    throw new Error("Invalid Steam count");
  if (data.game_count > STEAM_IMPORT_LIMIT) return { kind: "too_many" };
  if (data.game_count === 0) return { kind: "empty" };
  if (!Array.isArray(data.games) || data.games.length !== data.game_count)
    throw new Error("Incomplete Steam response");
  const games: SteamGame[] = [];
  for (const row of data.games) {
    if (
      !row ||
      !Number.isSafeInteger(row.appid) ||
      row.appid <= 0 ||
      typeof row.name !== "string"
    )
      throw new Error("Invalid Steam game");
    if (row.family_shared) continue;
    games.push({
      appid: row.appid,
      name: row.name,
      playtime: Number.isFinite(row.playtime_forever)
        ? Math.max(0, row.playtime_forever)
        : 0,
      lastPlayed: Number.isFinite(row.rtime_last_played)
        ? Math.max(0, row.rtime_last_played)
        : 0,
    });
  }
  return { kind: "games", games };
}
