import { db } from "@/db";
import { steamImportFlag } from "@/lib/flags";
import { igdbGameSource } from "@/lib/igdb";
import { readSteamGames } from "@/lib/steam";
import { createSteamImport } from "@/lib/steam-import";

// Enable only after the owner completes docs/verification/issue-151-steam-import.md.
export const steamImportEnabled = async () =>
  Boolean(process.env.STEAM_WEB_API_KEY && process.env.STEAM_STORAGE_COUNTRY) &&
  (await steamImportFlag());
export const steamImport = createSteamImport(db, igdbGameSource, (id) =>
  readSteamGames(id, process.env.STEAM_WEB_API_KEY ?? ""),
);
