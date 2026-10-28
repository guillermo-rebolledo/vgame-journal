import { and, desc, eq, getTableColumns, gt, inArray, sql } from "drizzle-orm";
import { type Db, db } from "@/db";
import {
  discoverySnapshot,
  game,
  journalEntry,
  releaseDate,
  scheduledRefresh,
  searchCache,
} from "@/db/schema";
import {
  type DiscoveryKey,
  type DiscoveryRank,
  type GameSource,
  type SourceGame,
  type SourceReleaseDate,
  STANDALONE_TYPES,
} from "@/lib/game-source";
import { igdbGameSource } from "@/lib/igdb";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 20;
const EROTIC_THEME_ID = 42;
/** Games per release date fetch; the GameSource pages past its own per-request limits. */
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

  /** Saves games and replaces supplied release dates; empty provider results retain known dates. */
  async function save(games: SourceGame[]) {
    if (games.length === 0) return;
    const syncedAt = new Date();
    const rows = games.map(
      ({
        type,
        releaseDates,
        popularity,
        fanMade,
        firstReleaseDate,
        themes,
        versionParent,
        ...g
      }) => ({
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
      new Map(
        games
          .filter((g) => g.releaseDates.length)
          .map((g) => [g.id, g.releaseDates]),
      ),
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

  const recent = (date: number | undefined, now: Date) =>
    date !== undefined &&
    date >= now.getTime() - 90 * 86400000 &&
    date <= now.getTime();

  // Bound even a source that ignores cancellation; never publish after its deadline.
  async function beforeDeadline<T>(
    signal: AbortSignal,
    work: () => Promise<T>,
  ) {
    signal.throwIfAborted();
    const result = await new Promise<T>((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      work()
        .then(resolve, reject)
        .finally(() => signal.removeEventListener("abort", abort));
    });
    signal.throwIfAborted();
    return result;
  }

  async function refreshShelf(
    key: DiscoveryKey,
    signal: AbortSignal,
    getRanks: (signal: AbortSignal) => Promise<DiscoveryRank[]>,
  ) {
    const now = new Date();
    const ranks = await getRanks(signal);
    const games: SourceGame[] = [];
    for (
      let start = 0;
      start < ranks.length && games.length < 4;
      start += 100
    ) {
      const candidates = ranks.slice(start, start + 100);
      const metadata = await beforeDeadline(signal, () =>
        source.fetchGames(
          candidates.map((r) => r.gameId),
          signal,
        ),
      );
      for (const rank of candidates) {
        const g = metadata.find((g) => g.id === rank.gameId);
        if (
          !g ||
          !STANDALONE_TYPES.has(g.type) ||
          g.fanMade ||
          g.versionParent ||
          g.themes?.includes(EROTIC_THEME_ID) ||
          !g.title?.trim() ||
          !/^[a-z0-9-]+$/.test(g.slug ?? "") ||
          !g.coverImageId?.trim() ||
          (key === "recent" && !recent(g.firstReleaseDate?.getTime(), now))
        )
          continue;
        games.push(g);
        if (games.length === 4) break;
      }
    }
    await save(games);
    signal.throwIfAborted();
    const values = {
      key,
      gameIds: games.map((g) => g.id),
      refreshedAt: new Date(),
      firstReleaseDates:
        key === "recent"
          ? (Object.fromEntries(
              games.map((g) => [g.id, g.firstReleaseDate?.getTime()]),
            ) as Record<string, number>)
          : {},
    };
    await db
      .insert(discoverySnapshot)
      .values(values)
      .onConflictDoUpdate({ target: discoverySnapshot.key, set: values });
    return games.length;
  }

  return {
    /** Shared durable selections only: Home never calls the external provider. */
    async discovery() {
      const snapshots = await db.select().from(discoverySnapshot);
      const now = new Date();
      const shelves = [];
      for (const key of ["recent", "popular"] as const) {
        const snapshot = snapshots.find((s) => s.key === key);
        if (!snapshot) continue;
        const ids = snapshot.gameIds.filter(
          (id) =>
            key !== "recent" || recent(snapshot.firstReleaseDates[id], now),
        );
        const games = (await load(ids)).filter(
          (g) => g.coverImageId && g.title && g.slug,
        );
        if (games.length)
          shelves.push({ key, games, refreshedAt: snapshot.refreshedAt });
      }
      return shelves;
    },
    /** Each selection succeeds independently; failures retain its last successful snapshot. */
    async refreshDiscovery(signal?: AbortSignal) {
      // Reuse only a complete successful scan; one shelf's source failure can be retried by the other.
      let ranks: DiscoveryRank[] | undefined;
      const getRanks = async (signal: AbortSignal) => {
        if (!ranks) {
          const all = await beforeDeadline(signal, () =>
            source.fetchDiscoveryRanks(signal),
          );
          const unique = new Map<number, DiscoveryRank>();
          for (const rank of all) {
            if (!Number.isFinite(rank.visits) || rank.visits <= 0) continue;
            if (rank.visits > (unique.get(rank.gameId)?.visits ?? 0))
              unique.set(rank.gameId, rank);
          }
          ranks = [...unique.values()].sort(
            (a, b) => b.visits - a.visits || a.gameId - b.gameId,
          );
        }
        signal.throwIfAborted();
        return ranks;
      };
      const results: Partial<Record<DiscoveryKey, number | "failed">> = {};
      for (const key of ["recent", "popular"] as const) {
        try {
          results[key] = await refreshShelf(
            key,
            signal ?? AbortSignal.timeout(45000),
            getRanks,
          );
        } catch {
          console.error(`Discovery refresh failed: ${key}`);
          results[key] = "failed";
        }
      }
      return results;
    },
    /** Cross-instance lease, also suppressing immediate cron retries after a failure. */
    async claimScheduledRefresh() {
      const now = new Date();
      const nextAttemptAt = new Date(now.getTime() + 5 * 60000);
      const claimed = await db
        .insert(scheduledRefresh)
        .values({ key: "daily", nextAttemptAt })
        .onConflictDoUpdate({
          target: scheduledRefresh.key,
          set: { nextAttemptAt },
          setWhere: sql`${scheduledRefresh.nextAttemptAt} <= ${now.toISOString()}`,
        })
        .returning();
      return claimed.length > 0;
    },
    /** Slugs of every Catalog game, most recently synced first, for the sitemap. Google allows 50,000 URLs per sitemap. */
    async indexedGames(limit = 10_000) {
      return db
        .select({ slug: game.slug, syncedAt: game.syncedAt })
        .from(game)
        .orderBy(desc(game.syncedAt))
        .limit(limit);
    },
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
     * so Countdowns follow delays. Batched; the GameSource keeps to its own rate limit. A game the source returns no dates for
     * keeps the ones it has (more likely a hiccup than a game losing every date). Returns how many games were checked.
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
        const fetched = await source.fetchReleaseDates(
          ids.slice(i, i + REFRESH_BATCH),
        );
        const dated = new Map([...fetched].filter(([, dates]) => dates.length));
        await replaceReleaseDates(dated);
        if (dated.size)
          await db
            .update(game)
            .set({ syncedAt: new Date() })
            .where(inArray(game.id, [...dated.keys()]));
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
