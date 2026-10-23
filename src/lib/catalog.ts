import { and, eq, getTableColumns, gt, inArray, sql } from "drizzle-orm";
import { type Db, db } from "@/db";
import { game, releaseDate, searchCache } from "@/db/schema";
import {
  type GameSource,
  type SourceGame,
  STANDALONE_TYPES,
} from "@/lib/game-source";
import { igdbGameSource } from "@/lib/igdb";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 20;

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
    const ids = games.map((g) => g.id);
    // ponytail: not atomic (neon-http has no transactions); a crash here leaves a game without dates until its next sync.
    await db.delete(releaseDate).where(inArray(releaseDate.gameId, ids));
    const dates = games.flatMap((g) =>
      g.releaseDates.map((d) => ({ ...d, gameId: g.id })),
    );
    if (dates.length) await db.insert(releaseDate).values(dates);
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

  return {
    /** A Catalog game with its release dates, earliest first (TBD last); null if we've never saved it. */
    async findBySlug(slug: string) {
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
