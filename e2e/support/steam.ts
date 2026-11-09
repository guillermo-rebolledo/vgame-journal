import { readSteamGames as read } from "../../src/lib/steam";

export type { SteamGame, SteamRead } from "../../src/lib/steam";
export { STEAM_IMPORT_LIMIT } from "../../src/lib/steam";
export const readSteamGames = (id: string, key: string) =>
  read(id, key, async (_input, init) =>
    fetch(`${process.env.E2E_SUPPORT_URL}/steam-games?steamid=${id}`, init),
  );
