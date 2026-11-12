import type { catalog } from "@/lib/catalog";
import type { RecommendationGame } from "@/lib/game-source";
import {
  type PlayNextGame,
  type PlayNextRequest,
  type PlayNextSnapshot,
  recommendationEligible,
  recommendationEvidence,
  recommendationQuery,
  releasedOn,
  shuffle,
} from "@/lib/play-next";

type Catalog = Pick<
  typeof catalog,
  "playNextJournal" | "playNextSeeds" | "playNextPage"
>;

/** Personal exclusions never enter the reusable public provider cache. */
export function createPlayNext(reads: Catalog) {
  return async (
    owner: string,
    request: PlayNextRequest,
  ): Promise<PlayNextSnapshot> => {
    const deadline = AbortSignal.timeout(45000);
    async function beforeDeadline<T>(work: () => Promise<T>): Promise<T> {
      deadline.throwIfAborted();
      return new Promise<T>((resolve, reject) => {
        const abort = () => reject(deadline.reason);
        deadline.addEventListener("abort", abort, { once: true });
        work()
          .then(resolve, reject)
          .finally(() => deadline.removeEventListener("abort", abort));
      });
    }
    const { entries, backlog } = await beforeDeadline(() =>
      reads.playNextJournal(owner),
    );
    const source = request.source ?? (backlog.length ? "backlog" : "discover");
    const snapshot: PlayNextSnapshot = {
      owner,
      source,
      provenance: source === "backlog" ? "backlog" : "related",
      backlogCount: backlog.length,
      games: [],
      bounded: false,
      platforms: [...new Set(backlog.flatMap((game) => game.platforms))].sort(),
      genres: [...new Set(backlog.flatMap((game) => game.genres))].sort(),
    };
    const project = (
      game: (typeof backlog)[number] | RecommendationGame["game"],
      reason: string,
      series: number[] = [],
    ): PlayNextGame => ({
      id: game.id,
      slug: game.slug,
      title: game.title,
      coverImageId: game.coverImageId,
      genres: game.genres,
      platforms: game.platforms.filter((platform) =>
        game.releaseDates.some(
          (date) =>
            date.platform === platform &&
            date.date &&
            date.date <= new Date() &&
            date.precision !== "tbd",
        ),
      ),
      year:
        game.releaseDates
          .find(
            (date) =>
              date.date &&
              date.date <= new Date() &&
              date.precision !== "tbd" &&
              (!request.platform || date.platform === request.platform),
          )
          ?.date?.getUTCFullYear() ?? null,
      reason,
      series,
      updatedAt:
        entries
          .find((entry) => entry.id === game.id)
          ?.updatedAt.toISOString() ?? null,
    });
    if (source === "backlog") {
      snapshot.games = shuffle(
        backlog
          .filter((game) => releasedOn(game, request))
          .map((game) => project(game, "You saved this to your Backlog.")),
      );
      return snapshot;
    }
    const ids = backlog.map((game) => game.id).sort((a, b) => a - b);
    // Spread twelve representative seeds across the entire Backlog, rather than one request per saved game.
    const seedIds = Array.from(
      { length: Math.min(12, ids.length) },
      (_, i) => ids[Math.floor((i * ids.length) / Math.min(12, ids.length))],
    );
    const seeds =
      request.popular || !seedIds.length
        ? []
        : await beforeDeadline(() => reads.playNextSeeds(seedIds));
    const excluded = new Set(entries.map((entry) => entry.id));
    async function pool(popular: boolean) {
      const query = recommendationQuery(popular ? [] : seeds, request, popular);
      const candidates = new Map<number, RecommendationGame>();
      if (!popular && (query.similar.length || query.series.length)) {
        const direct = await beforeDeadline(() =>
          reads.playNextPage(
            {
              ...query,
              genres: [],
              themes: [],
              perspectives: [],
              modes: [],
              franchises: [],
            },
            0,
          ),
        );
        for (const candidate of direct.games)
          candidates.set(candidate.game.id, candidate);
        snapshot.bounded ||= direct.hasMore;
      }
      for (let page = 0; page < 4; page++) {
        const result = await beforeDeadline(() =>
          reads.playNextPage(query, page),
        );
        for (const candidate of result.games)
          candidates.set(candidate.game.id, candidate);
        if (!result.hasMore) break;
        if (page === 3) snapshot.bounded = true;
      }
      return [...candidates.values()]
        .filter(
          (candidate) =>
            !excluded.has(candidate.game.id) &&
            recommendationEligible(candidate, request),
        )
        .map((candidate) => ({
          candidate,
          evidence: recommendationEvidence(candidate, seeds),
        }))
        .filter(({ evidence }) => popular || evidence.rank > 0)
        .sort(
          (a, b) =>
            (popular ? 0 : b.evidence.rank - a.evidence.rank) ||
            b.candidate.game.popularity - a.candidate.game.popularity ||
            a.candidate.game.id - b.candidate.game.id,
        )
        .map(({ candidate, evidence }) =>
          project(
            candidate.game,
            popular
              ? "Popular with many player ratings. This is not a personalized suggestion."
              : evidence.reason,
            candidate.series,
          ),
        );
    }
    snapshot.games = seeds.length ? await pool(false) : [];
    if (!snapshot.games.length) {
      snapshot.provenance = "popular";
      snapshot.games = await pool(true);
    }
    // Add observed options without removing the player's selected constraints.
    snapshot.platforms = [
      ...new Set([
        ...snapshot.platforms,
        ...snapshot.games.flatMap((game) => game.platforms),
        ...(request.platform ? [request.platform] : []),
      ]),
    ].sort();
    snapshot.genres = [
      ...new Set([
        ...snapshot.genres,
        ...snapshot.games.flatMap((game) => game.genres),
        ...(request.genre ? [request.genre] : []),
      ]),
    ].sort();
    return snapshot;
  };
}
