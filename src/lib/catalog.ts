import { and, eq, getTableColumns, gt, inArray, sql } from "drizzle-orm";
import { type Db, db } from "@/db";
import { game, journalEntry, releaseDate, searchCache } from "@/db/schema";
import {
  type GameSource,
  type SourceGame,
  type SourceReleaseDate,
  STANDALONE_TYPES,
} from "@/lib/game-source";
import { igdbGameSource } from "@/lib/igdb";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 20;
/** Games per release date request; IGDB returns at most 500 dates per request. */
const REFRESH_BATCH = 50;

export type SearchResult = {
  id: number;
  title: string;
  slug: string;
  coverImageId: string | null;
  year: number | null;
  platforms: string[];
};

/** Tests pass their own database and a fake GameSource. */
export function createCatalog(db: Db, source: GameSource) {
  /** Replaces the stored release dates of each game in the map. */
  async function replaceReleaseDates(byGame: Map<number, SourceReleaseDate[]>) {
    const ids = [...byGame.keys()];
    if (ids.length === 0) return;
    // ponytail: not atomic (neon-http has no transactions); a crash here leaves a game without dates until its next sync.
    await db.delete(releaseDate).where(inArray(releaseDate.gameId, ids));
    const dates = [...byGame].flatMap(([gameId, dates]) =>
      dates.map((d) => ({ ...d, gameId })),
    );
    if (dates.length) await db.insert(releaseDate).values(dates);
  }

  /** Saves (or refreshes) games and replaces their release dates. */
  async function save(games: SourceGame[]) {
    if (games.length === 0) return;
    const syncedAt = new Date();
    const rows = games.map(
      ({ type, releaseDates, popularity, fanMade, ...g }) => ({
        ...g,
        syncedAt,
      }),
    );
    await db
      .insert(game)
      .values(rows)
      .onConflictDoUpdate({
        target: game.id,
        set: Object.fromEntries(
          Object.entries(getTableColumns(game))
            .filter(([key]) => key !== "id")
            .map(([key, column]) => [key, sql.raw(`excluded.${column.name}`)]),
        ),
      });
    await replaceReleaseDates(
      new Map(games.map((g) => [g.id, g.releaseDates])),
    );
  }

  /** Catalog games in the given order. */
  async function load(ids: number[]): Promise<SearchResult[]> {
    if (ids.length === 0) return [];
    const rows = await db
      .select({
        id: game.id,
        title: game.title,
        slug: game.slug,
        coverImageId: game.coverImageId,
        platforms: game.platforms,
        year: sql<
          number | null
        >`extract(year from min(${releaseDate.date}) filter (where ${releaseDate.precision} <> 'tbd'))::int`,
      })
      .from(game)
      .leftJoin(releaseDate, eq(releaseDate.gameId, game.id))
      .where(inArray(game.id, ids))
      .groupBy(game.id);
    return ids.flatMap((id) => rows.find((r) => r.id === id) ?? []);
  }

  /** The game with its release dates, earliest first (undated last). */
  async function loadBySlug(slug: string) {
    const [found] = await db
      .select()
      .from(game)
      .where(eq(game.slug, slug))
      .limit(1);
    if (!found) return null;
    const releaseDates = await db
      .select()
      .from(releaseDate)
      .where(eq(releaseDate.gameId, found.id))
      .orderBy(sql`${releaseDate.date} asc nulls last`, releaseDate.id);
    return { ...found, releaseDates };
  }

  return {
    /** A Catalog game by slug; one nobody has searched yet (a shared link) is fetched from the GameSource and kept. */
    async findBySlug(slug: string) {
      const local = await loadBySlug(slug);
      if (local) return local;
      const fetched = await source.fetchBySlug(slug);
      if (!fetched || !STANDALONE_TYPES.has(fetched.type) || fetched.fanMade)
        return null;
      await save([fetched]);
      return loadBySlug(slug);
    },
    /**
     * Re-fetches release dates for every game on anyone's Wishlist that has a future or imprecise date (or none),
     * so Countdowns follow delays. Batched; the GameSource keeps to its own rate limit. Returns how many games were refreshed.
     */
    async refreshReleaseDates() {
      const now = new Date();
      const due = await db
        .selectDistinct({ id: journalEntry.gameId })
        .from(journalEntry)
        .where(
          and(
            eq(journalEntry.status, "wishlist"),
            sql`(
              exists (
                select 1 from ${releaseDate} where ${releaseDate.gameId} = ${journalEntry.gameId}
                and (${releaseDate.precision} <> 'day' or ${releaseDate.date} > ${now.toISOString()})
              )
              or not exists (select 1 from ${releaseDate} where ${releaseDate.gameId} = ${journalEntry.gameId})
            )`,
          ),
        );
      const ids = due.map((g) => g.id);
      for (let i = 0; i < ids.length; i += REFRESH_BATCH) {
        const batch = ids.slice(i, i + REFRESH_BATCH);
        await replaceReleaseDates(await source.fetchReleaseDates(batch));
        await db
          .update(game)
          .set({ syncedAt: new Date() })
          .where(inArray(game.id, batch));
      }
      return ids.length;
    },
    /** Local-first: a query searched in the last 24h is answered from the Catalog, otherwise the GameSource. */
    async search(rawQuery: string) {
      const query = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
      if (query.length < 2) return [];
      const now = new Date();
      const [cached] = await db
        .select()
        .from(searchCache)
        .where(
          and(
            eq(searchCache.query, query),
            gt(searchCache.fetchedAt, new Date(now.getTime() - CACHE_TTL_MS)),
          ),
        );
      if (cached) return load(cached.gameIds);

      const games = rank(
        query,
        (await source.search(query)).filter(
          (g) => STANDALONE_TYPES.has(g.type) && !g.fanMade,
        ),
      ).slice(0, MAX_RESULTS);
      await save(games);
      const gameIds = games.map((g) => g.id);
      // ponytail: expired rows are overwritten, never pruned; add a cleanup to the daily cron if the table grows large.
      await db
        .insert(searchCache)
        .values({ query, gameIds, fetchedAt: now })
        .onConflictDoUpdate({
          target: searchCache.query,
          set: { gameIds, fetchedAt: now },
        });
      return load(gameIds);
    },
  };
}

/**
 * The game you named (an exact title match) first, then the most popular, then games nobody has
 * rated or hyped in the source's own order. An exact match nobody tracks doesn't jump the queue.
 */
function rank(query: string, games: SourceGame[]) {
  const named = (g: SourceGame) =>
    g.popularity > 0 && normalize(g.title) === normalize(query);
  const tier = (g: SourceGame) => (named(g) ? 0 : g.popularity > 0 ? 1 : 2);
  // Array sort is stable, so ties keep the source's relevance order.
  return games.toSorted(
    (a, b) => tier(a) - tier(b) || b.popularity - a.popularity,
  );
}

/** "Hollow Knight: Silksong" and "hollow knight silksong" are the same title. */
const normalize = (title: string) =>
  title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export const catalog = createCatalog(db, igdbGameSource);
