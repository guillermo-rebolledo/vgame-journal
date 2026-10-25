import type { GameSource, SourceGame } from "@/lib/game-source";

/** In-memory GameSource: title-substring search, and a count of searches so tests can see the cache work. */
export function createFakeGameSource(games: SourceGame[]) {
  const source = {
    searches: 0,
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
      return new Map(
        games
          .filter((g) => ids.includes(g.id))
          .map((g) => [g.id, g.releaseDates]),
      );
    },
  } satisfies GameSource & { searches: number };
  return source;
}

let nextId = 1;

export const sourceGame = (overrides: Partial<SourceGame> = {}): SourceGame => {
  const id = overrides.id ?? nextId++;
  return {
    id,
    type: "main_game",
    title: `Game ${id}`,
    slug: `game-${id}`,
    summary: null,
    coverImageId: null,
    genres: [],
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
