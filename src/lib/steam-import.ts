import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { executeBatch } from "@/db/batch";
import { game, journalEntry, statusEvent, steamLink, user } from "@/db/schema";
import { createCatalog } from "@/lib/catalog";
import { ExpectedError } from "@/lib/expected-error";
import { type GameSource, STANDALONE_TYPES } from "@/lib/game-source";
import { createJournal } from "@/lib/journal";
import {
  STEAM_IMPORT_LIMIT,
  type SteamGame,
  type SteamRead,
} from "@/lib/steam";

export type SteamReviewRow = SteamGame & {
  gameId: number | null;
  state: "ready" | "needs_look" | "existing" | "removed" | "unmatched";
};
export type SteamReview =
  | { kind: "review"; rows: SteamReviewRow[] }
  | {
      kind:
        | "hidden"
        | "empty"
        | "too_many"
        | "unavailable"
        | "cooldown"
        | "disconnected";
    };

/** Owns transient matching, the import window and the verified connection. */
export function createSteamImport(
  db: Db,
  source: GameSource,
  read: (steamId: string) => Promise<SteamRead>,
) {
  const catalog = createCatalog(db, source);
  const journal = createJournal(db);
  const connection = async (userId: string) =>
    (
      await db.select().from(steamLink).where(eq(steamLink.userId, userId))
    )[0] ?? null;
  async function match(games: SteamGame[]) {
    const mappings = await source.mapSteamApps(
      games.map((g) => g.appid),
      AbortSignal.timeout(120_000),
    );
    const mappedApps = new Set(mappings.map((r) => r.appid));
    const byApp = new Map<number, { gameId: number; needsLook: boolean }[]>();
    for (const row of mappings) {
      const gameId =
        row.versionParent ??
        (row.type === "remaster" || row.type === "port"
          ? row.parentGame
          : row.type === "bundle"
            ? (row.parentGame ?? row.gameId)
            : STANDALONE_TYPES.has(row.type)
              ? row.gameId
              : null);
      if (!gameId) continue;
      const candidates = byApp.get(row.appid) ?? [];
      candidates.push({
        gameId,
        needsLook:
          row.type === "bundle" && !row.versionParent && !row.parentGame,
      });
      byApp.set(row.appid, candidates);
    }
    const seen = new Set<number>();
    const rows: SteamReviewRow[] = [];
    for (const g of games) {
      const candidates = byApp.get(g.appid) ?? [];
      const ids = new Set(candidates.map((r) => r.gameId));
      // Ambiguous external IDs are never silently assigned to one of several games.
      if (ids.size !== 1) {
        if (!mappedApps.has(g.appid) || ids.size > 1)
          rows.push({ ...g, gameId: null, state: "unmatched" });
        continue;
      }
      const candidate = candidates[0];
      if (seen.has(candidate.gameId)) continue;
      seen.add(candidate.gameId);
      rows.push({
        ...g,
        gameId: candidate.gameId,
        state: candidates.some((r) => r.needsLook) ? "needs_look" : "ready",
      });
    }
    return rows;
  }
  return {
    connection,
    async link(userId: string, steamId: string) {
      if (!/^\d{17}$/.test(steamId))
        throw new ExpectedError("Invalid Steam identity.");
      await executeBatch(db, [
        sql`select id from ${user} where id = ${userId} for update`,
        db
          .insert(steamLink)
          .values({ userId, steamId, linkedAt: new Date() })
          .onConflictDoUpdate({
            target: steamLink.userId,
            set: {
              steamId,
              linkedAt: new Date(),
              nextImportAt: null,
              reviewReady: false,
            },
          })
          .getSQL(),
      ]);
    },
    async unlink(userId: string) {
      await executeBatch(db, [
        sql`select id from ${user} where id = ${userId} for update`,
        db.delete(steamLink).where(eq(steamLink.userId, userId)).getSQL(),
      ]);
    },
    async review(userId: string): Promise<SteamReview> {
      const windowEndsAt = new Date(Date.now() + 60_000);
      const [link] = await db
        .update(steamLink)
        .set({
          nextImportAt: windowEndsAt,
          reviewReady: false,
        })
        .where(
          and(
            eq(steamLink.userId, userId),
            or(
              isNull(steamLink.nextImportAt),
              lte(steamLink.nextImportAt, new Date()),
            ),
          ),
        )
        .returning();
      if (!link)
        return {
          kind: (await connection(userId)) ? "cooldown" : "disconnected",
        };
      try {
        const result = await read(link.steamId);
        if (result.kind !== "games") return result;
        if (result.games.length > STEAM_IMPORT_LIMIT)
          return { kind: "too_many" };
        const rows = await match(result.games);
        const [entries, history] = await Promise.all([
          db
            .select({ gameId: journalEntry.gameId })
            .from(journalEntry)
            .where(eq(journalEntry.userId, userId)),
          db
            .selectDistinct({ gameId: statusEvent.gameId })
            .from(statusEvent)
            .where(eq(statusEvent.userId, userId)),
        ]);
        const [readyLink] = await db
          .update(steamLink)
          .set({ reviewReady: true })
          .where(
            and(
              eq(steamLink.userId, userId),
              eq(steamLink.steamId, link.steamId),
              eq(steamLink.nextImportAt, windowEndsAt),
            ),
          )
          .returning();
        if (!readyLink) return { kind: "unavailable" };
        const existing = new Set(entries.map((e) => e.gameId));
        const removed = new Set(history.map((e) => e.gameId));
        return {
          kind: "review",
          rows: rows.map((r) => ({
            ...r,
            state:
              r.gameId && existing.has(r.gameId)
                ? "existing"
                : r.gameId && removed.has(r.gameId)
                  ? "removed"
                  : r.state,
          })),
        };
      } catch {
        return { kind: "unavailable" };
      }
    },
    async commit(userId: string, selection: unknown) {
      if (
        !Array.isArray(selection) ||
        selection.length > STEAM_IMPORT_LIMIT ||
        selection.some((id) => !Number.isSafeInteger(id) || id <= 0)
      )
        throw new ExpectedError("Choose up to 10,000 valid Steam games.");
      const ids = [...new Set<number>(selection)];
      if (!ids.length) throw new ExpectedError("Select at least one game.");
      const leaseEndsAt = new Date(Date.now() + 180_000);
      const [link] = await db
        .update(steamLink)
        .set({
          nextImportAt: leaseEndsAt,
          reviewReady: false,
        })
        .where(
          and(
            eq(steamLink.userId, userId),
            or(
              isNull(steamLink.nextImportAt),
              lte(steamLink.nextImportAt, new Date()),
              eq(steamLink.reviewReady, true),
            ),
          ),
        )
        .returning();
      if (!link)
        throw new ExpectedError(
          "Steam is disconnected or an import is already running. Try again in five minutes.",
        );
      try {
        const rows = await match(
          ids.map((appid) => ({ appid, name: "", playtime: 0, lastPlayed: 0 })),
        );
        const gameIds = rows
          .filter((r) => r.state === "ready")
          .map((r) => r.gameId as number);
        const cached = gameIds.length
          ? await db
              .select({ id: game.id })
              .from(game)
              .where(inArray(game.id, gameIds))
          : [];
        const known = new Set(cached.map((g) => g.id));
        const missing = gameIds.filter((id) => !known.has(id));
        const fetched = await source.fetchGames(
          missing,
          AbortSignal.timeout(120_000),
        );
        const fetchedIds = new Set(fetched.map((g) => g.id));
        if (missing.some((id) => !fetchedIds.has(id)))
          throw new Error("Incomplete Catalog response");
        for (let start = 0; start < fetched.length; start += 500)
          await catalog.save(fetched.slice(start, start + 500));
        const result = await journal.importGames(userId, gameIds, link.steamId);
        await db
          .update(steamLink)
          .set({ nextImportAt: new Date(Date.now() + 300_000) })
          .where(
            and(
              eq(steamLink.userId, userId),
              eq(steamLink.steamId, link.steamId),
              eq(steamLink.nextImportAt, leaseEndsAt),
            ),
          );
        return result;
      } catch (error) {
        await db
          .update(steamLink)
          .set({ nextImportAt: new Date(Date.now() + 60_000) })
          .where(
            and(
              eq(steamLink.userId, userId),
              eq(steamLink.steamId, link.steamId),
              eq(steamLink.nextImportAt, leaseEndsAt),
            ),
          );
        throw error;
      }
    },
  };
}
