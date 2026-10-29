import {
  compareTagGames,
  type GameSource,
  type SourceGame,
} from "@/lib/game-source";

/** In-memory GameSource: title-substring search, and logs of searches and release date fetches so tests can see what was asked. */
export function createFakeGameSource(
  games: (SourceGame & { visits?: number })[],
) {
  const source = {
    searches: 0,
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
            g.firstReleaseDate <= through &&
            ((g.userScoreCount ?? 0) >= 10 || (g.criticScoreCount ?? 0) >= 3),
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
    ...overrides,
  };
};
