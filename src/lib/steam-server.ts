import { db } from "@/db";
import { igdbGameSource } from "@/lib/igdb";
import { readSteamGames } from "@/lib/steam";
import { createSteamImport } from "@/lib/steam-import";

// Enable only after the owner completes docs/verification/issue-151-steam-import.md.
export const steamImportEnabled = () =>
  process.env.STEAM_IMPORT_ENABLED === "true" &&
  Boolean(process.env.STEAM_WEB_API_KEY && process.env.STEAM_STORAGE_COUNTRY);
export const steamImport = createSteamImport(db, igdbGameSource, (id) =>
  readSteamGames(id, process.env.STEAM_WEB_API_KEY ?? ""),
);
