import { and, desc, eq, getTableColumns, gt, inArray, sql } from "drizzle-orm";
import { type Db, db } from "@/db";
import { executeBatch } from "@/db/batch";
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
import { createRefreshState } from "@/lib/refresh-state";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SEARCH_CANDIDATES = 50;
const EROTIC_THEME_ID = 42;
const DAY_MS = 86400000;
const RELEASE_BOOST_DAYS = 30;
const MAX_TRENDING_BOOST = 2;
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
  const refreshState = createRefreshState(db);
  /** Replaces the stored release dates of each game in the map. */
  async function replaceReleaseDates(byGame: Map<number, SourceReleaseDate[]>) {
    const ids = [...byGame.keys()];
    if (ids.length === 0) return;
    const dates = [...byGame].flatMap(([gameId, dates]) =>
      dates.map((d) => ({ ...d, gameId })),
    );
    if (dates.length)
      await executeBatch(db, [
        db.delete(releaseDate).where(inArray(releaseDate.gameId, ids)).getSQL(),
        db.insert(releaseDate).values(dates).getSQL(),
      ]);
    else await db.delete(releaseDate).where(inArray(releaseDate.gameId, ids));
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
    date >= now.getTime() - 90 * DAY_MS &&
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
    const from = new Date(now.getTime() - 90 * DAY_MS);
    const candidates = new Map<number, SourceGame>();
    for (let afterId = 0; ; ) {
      const page = await beforeDeadline(signal, () =>
        source.fetchRecentCandidates(afterId, from, now, signal),
      );
      for (const g of page.games) {
        if (homepageEligible(g) && recent(g.firstReleaseDate?.getTime(), now))
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
    // Activity still drives discovery; age gradually gives newer launches room.
    const score = (r: DiscoveryRank) => {
      const released = candidates.get(r.gameId)?.firstReleaseDate as Date;
      const ageDays = (now.getTime() - released.getTime()) / DAY_MS;
      return r.visits / (1 + ageDays / RELEASE_BOOST_DAYS);
    };
    const selected = [...ranks.values()]
      .sort((a, b) => score(b) - score(a) || a.gameId - b.gameId)
      .slice(0, 4);
    return publishShelf(
      "recent",
      selected.map((r) => candidates.get(r.gameId) as SourceGame),
      signal,
    );
  }

  async function refreshShelf(
    key: DiscoveryKey,
    signal: AbortSignal,
    getPage: (index: number, signal: AbortSignal) => Promise<DiscoveryRankPage>,
  ) {
    const now = Date.now();
    const selected: { score: number; game: SourceGame }[] = [];
    for (let index = 0; ; index++) {
      const page = await getPage(index, signal);
      const tail = page.ranks.at(-1)?.visits;
      const ranks = page.ranks
        .filter((r) => Number.isFinite(r.visits) && r.visits > 0)
        .toSorted((a, b) => b.visits - a.visits || a.gameId - b.gameId);
      for (let start = 0; start < ranks.length; start += 100) {
        if (
          selected.length === 4 &&
          ranks[start].visits * MAX_TRENDING_BOOST < selected[3].score
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
          const releaseDistance =
            Math.abs(now - (g.firstReleaseDate?.getTime() ?? Number.NaN)) /
            DAY_MS;
          // Up to 2x around launch, tapering to 1x at ±30 days; older hits stay eligible.
          const boost = Number.isFinite(releaseDistance)
            ? 1 +
              (MAX_TRENDING_BOOST - 1) *
                Math.max(0, 1 - releaseDistance / RELEASE_BOOST_DAYS)
            : 1;
          selected.push({ score: rank.visits * boost, game: g });
        }
        selected.sort((a, b) => b.score - a.score || a.game.id - b.game.id);
        selected.splice(4);
      }
      // Stop only when no remaining game's maximum launch boost can reach the cutoff.
      if (
        !page.hasMore ||
        (selected.length === 4 &&
          tail !== undefined &&
          Number.isFinite(tail) &&
          tail * MAX_TRENDING_BOOST < selected[3].score)
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
    save,
    tagGames,
    playNextSeeds: (ids: number[]) =>
      source.fetchRecommendationSeeds(ids, AbortSignal.timeout(15000)),
    playNextPage: (
      query: import("./game-source").RecommendationQuery,
      page: number,
    ) =>
      source.fetchRecommendationPage(query, page, AbortSignal.timeout(15000)),
    async playNextJournal(owner: string) {
      const entries = await db
        .select({
          id: journalEntry.gameId,
          status: journalEntry.status,
          updatedAt: journalEntry.updatedAt,
        })
        .from(journalEntry)
        .where(eq(journalEntry.userId, owner));
      const backlog = await db
        .select({ game })
        .from(journalEntry)
        .innerJoin(game, eq(game.id, journalEntry.gameId))
        .where(
          and(
            eq(journalEntry.userId, owner),
            eq(journalEntry.status, "backlog"),
          ),
        );
      const ids = backlog.map((row) => row.game.id);
      const dates = ids.length
        ? await db
            .select()
            .from(releaseDate)
            .where(inArray(releaseDate.gameId, ids))
        : [];
      return {
        entries,
        backlog: backlog.map(({ game }) => ({
          ...game,
          releaseDates: dates.filter((date) => date.gameId === game.id),
        })),
      };
    },
    refreshHealth: refreshState.health,
    async runScheduledRefresh(signal?: AbortSignal) {
      // Leave half the 180s hosting budget for bounded database writes and outcome persistence.
      const deadline = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(90000)])
        : AbortSignal.timeout(90000);
      if (!(await this.claimScheduledRefresh())) {
        await refreshState.skipped();
        return { skipped: true, outcome: "skipped" as const };
      }
      return refreshState.run(
        "daily",
        async () => {
          // Both jobs replace release dates; settle Wishlist writes before Discovery starts.
          const [wishlist] = await Promise.allSettled([
            this.refreshReleaseDates(deadline),
          ]);
          const [discovery] = await Promise.allSettled([
            this.refreshDiscovery(deadline),
          ]);
          const checked =
            wishlist.status === "fulfilled"
              ? wishlist.value
              : ("failed" as const);
          const selections =
            discovery.status === "fulfilled"
              ? discovery.value
              : ("failed" as const);
          const tasks = [
            checked,
            ...(selections === "failed"
              ? ["failed", "failed"]
              : [selections.recent, selections.popular]),
          ];
          const failed = tasks.filter(
            (result) => typeof result !== "number",
          ).length;
          const outcome =
            failed === 0
              ? ("success" as const)
              : failed === tasks.length
                ? ("failure" as const)
                : ("partial" as const);
          return { checked, discovery: selections, outcome };
        },
        (result) => result.outcome,
      );
    },
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
          results[key] = await refreshState.run(key, () =>
            key === "recent"
              ? refreshRecent(deadline)
              : refreshShelf(key, deadline, getPage),
          );
        } catch {
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
        if (local.tags !== null && local.ageRatings !== null) return local;
        try {
          const refreshed = await source.fetchGame(local.id);
          if (refreshed) {
            await save([refreshed]);
            return (await loadBySlug(refreshed.slug)) ?? local;
          }
        } catch {
          // An optional refresh (tags, age ratings, languages) must never hide an existing Catalog game.
        }
        return local;
      }
      const fetched = await source.fetchBySlug(slug);
      if (
        !fetched ||
        !STANDALONE_TYPES.has(fetched.type) ||
        fetched.fanMade ||
        fetched.versionParent
      )
        return null;
      await save([fetched]);
      return loadBySlug(slug);
    },
    /**
     * Re-fetches release dates for every game on anyone's Wishlist that has a future or imprecise date (or none),
     * so Countdowns follow delays. Batched; the GameSource keeps to its own rate limit. A game the source returns no dates for
     * keeps the ones it has (more likely a hiccup than a game losing every date). Returns how many games were checked.
     */
    async refreshReleaseDates(signal = AbortSignal.timeout(90000)) {
      return refreshState.run("wishlist", async () => {
        signal.throwIfAborted();
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
          const fetched = await beforeDeadline(signal, () =>
            source.fetchReleaseDates(ids.slice(i, i + REFRESH_BATCH), signal),
          );
          const dated = new Map(
            [...fetched].filter(([, dates]) => dates.length),
          );
          signal.throwIfAborted();
          await replaceReleaseDates(dated);
          signal.throwIfAborted();
          if (dated.size)
            await db
              .update(game)
              .set({ syncedAt: new Date() })
              .where(inArray(game.id, [...dated.keys()]));
        }
        signal.throwIfAborted();
        return ids.length;
      });
    },
    /** Local-first: a query searched in the last 24h is answered from the Catalog, otherwise the GameSource. */
    async search(rawQuery: string) {
      const query = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
      if (query.length < 2) return [];
      // Older caches excluded expanded games and lacked the spacing fallback.
      const cacheKey = `v3:${query}`;
      const now = new Date();
      const [cached] = await db
        .select()
        .from(searchCache)
        .where(
          and(
            eq(searchCache.query, cacheKey),
            gt(searchCache.fetchedAt, new Date(now.getTime() - CACHE_TTL_MS)),
          ),
        );
      if (cached) return load(cached.gameIds);

      const games = rank(
        query,
        (await source.search(query))
          .slice(0, MAX_SEARCH_CANDIDATES)
          .filter(
            (g) =>
              STANDALONE_TYPES.has(g.type) && !g.fanMade && !g.versionParent,
          ),
      );
      await save(games);
      const gameIds = games.map((g) => g.id);
      // ponytail: expired rows are overwritten, never pruned; add a cleanup to the daily cron if the table grows large.
      await db
        .insert(searchCache)
        .values({ query: cacheKey, gameIds, fetchedAt: now })
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
