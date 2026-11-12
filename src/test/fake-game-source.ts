import {
  compareTagGames,
  type GameSource,
  type RecommendationGame,
  type RecommendationQuery,
  type SourceGame,
  type SteamMapping,
} from "@/lib/game-source";

/** In-memory GameSource: title-substring search, and logs of searches and release date fetches so tests can see what was asked. */
export function createFakeGameSource(
  games: (SourceGame & { visits?: number })[],
  steamMappings: SteamMapping[] = [],
  relationships: Partial<
    Record<number, Partial<Omit<RecommendationGame, "game">>>
  > = {},
) {
  const recommendation = (game: SourceGame): RecommendationGame => ({
    game,
    similar: [],
    series: [],
    franchises: [],
    genres: [],
    themes: [],
    perspectives: [],
    modes: [],
    ...relationships[game.id],
  });
  const source = {
    async fetchRecommendationSeeds(ids: number[], signal: AbortSignal) {
      signal.throwIfAborted();
      return games.filter((game) => ids.includes(game.id)).map(recommendation);
    },
    async fetchRecommendationPage(
      query: RecommendationQuery,
      page: number,
      signal: AbortSignal,
    ) {
      signal.throwIfAborted();
      const pool = games
        .map(recommendation)
        .filter(
          (candidate) =>
            (!query.platform ||
              candidate.game.platforms.includes(query.platform)) &&
            (!query.genre || candidate.game.genres.includes(query.genre)) &&
            (query.popular ||
              query.similar.includes(candidate.game.id) ||
              (
                [
                  "series",
                  "franchises",
                  "genres",
                  "themes",
                  "perspectives",
                  "modes",
                ] as const
              ).some((key) =>
                candidate[key].some((id) => query[key].includes(id)),
              )),
        )
        .sort((a, b) => compareTagGames(a.game, b.game));
      return {
        games: pool.slice(page * 100, (page + 1) * 100),
        hasMore: pool.length > (page + 1) * 100,
      };
    },
    searches: 0,
    async mapSteamApps(appids: number[], signal: AbortSignal) {
      signal.throwIfAborted();
      return steamMappings.filter((row) => appids.includes(row.appid));
    },
    async fetchTagGames(slug: string, limit: number, signal: AbortSignal) {
      signal.throwIfAborted();
      return games
        .filter((g) => g.tags.includes(slug))
        .toSorted(compareTagGames)
        .slice(0, limit);
    },
    async fetchDiscoveryRanks(excludedIds: number[], signal: AbortSignal) {
      signal.throwIfAborted();
      const ranks = games
        .filter((g) => !excludedIds.includes(g.id))
        .map((g) => ({ gameId: g.id, visits: g.visits ?? 0 }))
        .sort((a, b) => b.visits - a.visits);
      return { ranks: ranks.slice(0, 500), hasMore: ranks.length >= 500 };
    },
    async fetchRecentCandidates(
      afterId: number,
      from: Date,
      through: Date,
      signal: AbortSignal,
    ) {
      signal.throwIfAborted();
      const pool = games
        .filter(
          (g) =>
            g.id > afterId &&
            g.firstReleaseDate &&
            g.firstReleaseDate >= from &&
            g.firstReleaseDate <= through,
        )
        .toSorted((a, b) => a.id - b.id);
      return { games: pool.slice(0, 500), hasMore: pool.length >= 500 };
    },
    async fetchVisits(ids: number[], signal: AbortSignal) {
      signal.throwIfAborted();
      return games
        .filter((g) => ids.includes(g.id))
        .map((g) => ({ gameId: g.id, visits: g.visits ?? 0 }));
    },
    async fetchGames(ids: number[], signal: AbortSignal) {
      signal.throwIfAborted();
      return games.filter((g) => ids.includes(g.id));
    },
    releaseDateFetches: [] as number[][],
    async search(query: string) {
      source.searches++;
      const q = query.toLowerCase();
      return games.filter((g) => g.title.toLowerCase().includes(q));
    },
    async fetchGame(id: number) {
      return games.find((g) => g.id === id) ?? null;
    },
    async fetchBySlug(slug: string) {
      return games.find((g) => g.slug === slug) ?? null;
    },
    async fetchReleaseDates(ids: number[]) {
      source.releaseDateFetches.push(ids);
      return new Map(
        games
          .filter((g) => ids.includes(g.id))
          .map((g) => [g.id, g.releaseDates]),
      );
    },
  } satisfies GameSource & {
    searches: number;
    releaseDateFetches: number[][];
  };
  return source;
}

let nextId = 1;

export const sourceGame = (
  overrides: Partial<SourceGame> & { visits?: number } = {},
): SourceGame & { visits?: number } => {
  const id = overrides.id ?? nextId++;
  return {
    id,
    type: "main_game",
    title: `Game ${id}`,
    slug: `game-${id}`,
    summary: null,
    coverImageId: null,
    genres: [],
    tags: [],
    platforms: [],
    releaseDates: [],
    criticScore: null,
    criticScoreCount: null,
    userScore: null,
    userScoreCount: null,
    popularity: 0,
    fanMade: false,
    ageRatings: [],
    languages: [],
    ...overrides,
  };
};
