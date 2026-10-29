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
  compareTagGames,
  type DiscoveryKey,
  type DiscoveryRank,
  type DiscoveryRankPage,
  type GameSource,
  type SourceGame,
  type SourceReleaseDate,
  STANDALONE_TYPES,
} from "@/lib/game-source";
import { GAME_TAGS, type Tag, type TagShelf } from "@/lib/game-tags";
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

/** A complete review arm must qualify; missing or malformed evidence never does. */
const hasRecentQuality = (g: {
  userScore: number | null;
  userScoreCount: number | null;
  criticScore: number | null;
  criticScoreCount: number | null;
}) => {
  const qualifies = (
    score: number | null,
    count: number | null,
    minimum: number,
  ) =>
    score !== null &&
    Number.isFinite(score) &&
    score >= 75 &&
    score <= 100 &&
    count !== null &&
    Number.isSafeInteger(count) &&
    count >= minimum;
  return (
    qualifies(g.userScore, g.userScoreCount, 10) ||
    qualifies(g.criticScore, g.criticScoreCount, 3)
  );
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
  async function load(
    ids: number[],
    requireQuality = false,
  ): Promise<SearchResult[]> {
    if (ids.length === 0) return [];
    const rows = await db
      .select({
        userScore: game.userScore,
        userScoreCount: game.userScoreCount,
        criticScore: game.criticScore,
        criticScoreCount: game.criticScoreCount,
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
    const eligible = rows
      .filter((r) => !requireQuality || hasRecentQuality(r))
      .map(
        ({
          userScore,
          userScoreCount,
          criticScore,
          criticScoreCount,
          ...result
        }) => result,
      );
    return ids.flatMap((id) => eligible.find((r) => r.id === id) ?? []);
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

  const homepageEligible = (g: SourceGame) =>
    STANDALONE_TYPES.has(g.type) &&
    !g.fanMade &&
    !g.versionParent &&
    !g.themes?.includes(EROTIC_THEME_ID) &&
    Boolean(g.title?.trim()) &&
    /^[a-z0-9-]+$/.test(g.slug ?? "") &&
    Boolean(g.coverImageId?.trim());

  async function refreshRecent(signal: AbortSignal) {
    const now = new Date();
    const from = new Date(now.getTime() - 90 * 86400000);
    const candidates = new Map<number, SourceGame>();
    for (let afterId = 0; ; ) {
      const page = await beforeDeadline(signal, () =>
        source.fetchRecentCandidates(afterId, from, now, signal),
      );
      for (const g of page.games) {
        if (
          homepageEligible(g) &&
          hasRecentQuality(g) &&
          recent(g.firstReleaseDate?.getTime(), now)
        )
          candidates.set(g.id, g);
      }
      if (!page.hasMore) break;
      const nextId = Math.max(...page.games.map((g) => g.id));
      if (!Number.isSafeInteger(nextId) || nextId <= afterId)
        throw new Error("Recent source returned a non-progressing page");
      afterId = nextId;
    }
    const visits = await beforeDeadline(signal, () =>
      source.fetchVisits([...candidates.keys()], signal),
    );
    const ranks = new Map<number, DiscoveryRank>();
    for (const rank of visits) {
      if (
        !candidates.has(rank.gameId) ||
        !Number.isFinite(rank.visits) ||
        rank.visits <= 0
      )
        continue;
      if (rank.visits > (ranks.get(rank.gameId)?.visits ?? 0))
        ranks.set(rank.gameId, rank);
    }
    const compare = (a: DiscoveryRank, b: DiscoveryRank) =>
      b.visits - a.visits || a.gameId - b.gameId;
    const ordered = [...ranks.values()].sort(compare);
    const selected = ordered
      .filter((r) => candidates.get(r.gameId)?.genres.includes("Indie"))
      .slice(0, 2);
    for (const rank of ordered) {
      if (selected.length === 4) break;
      if (!selected.some((r) => r.gameId === rank.gameId)) selected.push(rank);
    }
    return publishShelf(
      "recent",
      selected.sort(compare).map((r) => candidates.get(r.gameId) as SourceGame),
      signal,
    );
  }

  async function refreshShelf(
    key: DiscoveryKey,
    signal: AbortSignal,
    getPage: (index: number, signal: AbortSignal) => Promise<DiscoveryRankPage>,
  ) {
    const selected: { rank: DiscoveryRank; game: SourceGame }[] = [];
    for (let index = 0; ; index++) {
      const page = await getPage(index, signal);
      const tail = page.ranks.at(-1)?.visits;
      const ranks = page.ranks
        .filter((r) => Number.isFinite(r.visits) && r.visits > 0)
        .toSorted((a, b) => b.visits - a.visits || a.gameId - b.gameId);
      for (let start = 0; start < ranks.length; start += 100) {
        if (
          selected.length === 4 &&
          ranks[start].visits < selected[3].rank.visits
        )
          break;
        const candidates = ranks.slice(start, start + 100);
        const metadata = await beforeDeadline(signal, () =>
          source.fetchGames(
            candidates.map((r) => r.gameId),
            signal,
          ),
        );
        for (const rank of candidates) {
          const g = metadata.find((g) => g.id === rank.gameId);
          if (!g || !homepageEligible(g)) continue;
          selected.push({ rank, game: g });
        }
        selected.sort(
          (a, b) => b.rank.visits - a.rank.visits || a.game.id - b.game.id,
        );
        selected.splice(4);
      }
      // A full boundary tie must be drained before canonical-ID ordering is final.
      if (
        !page.hasMore ||
        (selected.length === 4 &&
          tail !== undefined &&
          Number.isFinite(tail) &&
          tail < selected[3].rank.visits)
      )
        break;
    }
    return publishShelf(
      key,
      selected.map((s) => s.game),
      signal,
    );
  }

  async function publishShelf(
    key: DiscoveryKey,
    games: SourceGame[],
    signal: AbortSignal,
  ) {
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

  async function tagGames(slug: string) {
    return source.fetchTagGames(slug, 24, AbortSignal.timeout(10000));
  }

  return {
    tagGames,
    /** Shelves stay transient; only visiting a recommended game adds it to Catalog. */
    async tagShelves(
      gameId: number,
      tags: string[] | null,
      fetchTag: (slug: string) => Promise<SourceGame[]> = tagGames,
    ): Promise<TagShelf[]> {
      const explorable = GAME_TAGS.filter(
        (tag: Tag) => !tag.broad && tags?.includes(tag.slug),
      ).slice(0, 8);
      // ponytail: use IGDB /multiquery if eight rate-limited cold tag lookups become noticeable.
      return (
        await Promise.all(
          explorable.map(async (tag) => {
            const candidates = await fetchTag(tag.slug);
            const unique = new Map<number, SourceGame>();
            for (const g of candidates.toSorted(compareTagGames)) {
              if (g.id !== gameId && homepageEligible(g) && !unique.has(g.id))
                unique.set(g.id, g);
            }
            const games = [...unique.values()].slice(0, 6).map((g) => ({
              id: g.id,
              title: g.title,
              slug: g.slug,
              coverImageId: g.coverImageId as string,
            }));
            return { tag, games };
          }),
        )
      ).filter((shelf) => shelf.games.length > 0);
    },
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
        const games = (await load(ids, key === "recent")).filter(
          (g) => g.coverImageId && g.title && g.slug,
        );
        if (games.length)
          shelves.push({ key, games, refreshedAt: snapshot.refreshedAt });
      }
      return shelves;
    },
    /** Each selection succeeds independently; failures retain its last successful snapshot. */
    async refreshDiscovery(signal?: AbortSignal) {
      // Cache ranked pages during the popular shelf traversal.
      const pages: DiscoveryRankPage[] = [];
      const seen = new Set<number>();
      const getPage = async (index: number, signal: AbortSignal) => {
        signal.throwIfAborted();
        if (!pages[index]) {
          const page = await beforeDeadline(signal, () =>
            source.fetchDiscoveryRanks([...seen], signal),
          );
          const unique = new Map<number, DiscoveryRank>();
          for (const rank of page.ranks) {
            if (seen.has(rank.gameId)) continue;
            const previous = unique.get(rank.gameId);
            if (!previous || rank.visits > previous.visits)
              unique.set(rank.gameId, rank);
          }
          if (page.hasMore && unique.size === 0)
            throw new Error("Discovery source returned a non-progressing page");
          for (const id of unique.keys()) seen.add(id);
          pages.push({ ranks: [...unique.values()], hasMore: page.hasMore });
        }
        return pages[index];
      };
      const results: Partial<Record<DiscoveryKey, number | "failed">> = {};
      for (const key of ["recent", "popular"] as const) {
        try {
          const deadline = signal
            ? AbortSignal.any([signal, AbortSignal.timeout(45000)])
            : AbortSignal.timeout(45000);
          results[key] =
            key === "recent"
              ? await refreshRecent(deadline)
              : await refreshShelf(key, deadline, getPage);
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
      if (local) {
        if (local.tags !== null) return local;
        try {
          const refreshed = await source.fetchGame(local.id);
          if (refreshed) {
            await save([refreshed]);
            return (await loadBySlug(refreshed.slug)) ?? local;
          }
        } catch {
          // An optional tag refresh must never hide an existing Catalog game.
        }
        return local;
      }
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
