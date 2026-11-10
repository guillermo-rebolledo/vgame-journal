import type { Db } from "../../src/db";
import { createSteamOpenId as create } from "../../src/lib/steam-openid";
export const createSteamOpenId = (db: Db, url: string) =>
  create(db, url, async (_input, init) =>
    fetch(`${process.env.E2E_SUPPORT_URL}/steam-verify`, init),
  );
