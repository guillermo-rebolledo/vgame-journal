/** The external game catalog (IGDB). The real implementation is `igdb.ts`; tests use `src/test/fake-game-source.ts`. */
export interface GameSource {
  /** Complete Visits ranks; consumers filter and order locally. */
  fetchDiscoveryRanks(signal: AbortSignal): Promise<DiscoveryRank[]>;
  fetchGames(ids: number[], signal: AbortSignal): Promise<SourceGame[]>;
  search(query: string): Promise<SourceGame[]>;
  fetchGame(id: number): Promise<SourceGame | null>;
  fetchBySlug(slug: string): Promise<SourceGame | null>;
  fetchReleaseDates(ids: number[]): Promise<Map<number, SourceReleaseDate[]>>;
}

export type DiscoveryRank = { gameId: number; visits: number };
export type DiscoveryKey = "recent" | "popular";

/** IGDB game types; the index is IGDB's `game_types` id. */
export const GAME_TYPES = [
  "main_game",
  "dlc_addon",
  "expansion",
  "bundle",
  "standalone_expansion",
  "mod",
  "episode",
  "season",
  "remake",
  "remaster",
  "expanded_game",
  "port",
  "fork",
  "pack",
  "update",
] as const;

export type GameType = (typeof GAME_TYPES)[number];

/** Only these become Catalog games; DLC, remasters, ports, editions etc. never do. */
export const STANDALONE_TYPES: ReadonlySet<GameType> = new Set([
  "main_game",
  "standalone_expansion",
  "remake",
]);

export type SourceGame = {
  id: number;
  type: GameType;
  title: string;
  slug: string;
  summary: string | null;
  coverImageId: string | null;
  genres: string[];
  platforms: string[];
  releaseDates: SourceReleaseDate[];
  criticScore: number | null;
  criticScoreCount: number | null;
  userScore: number | null;
  userScoreCount: number | null;
  /** How many people rated or are waiting for it; 0 for obscure games. */
  popularity: number;
  /** Fan games, unofficial ports and the like. */
  fanMade: boolean;
  firstReleaseDate?: Date | null;
  themes?: number[];
  versionParent?: number | null;
};

export type DatePrecision = "day" | "month" | "quarter" | "year" | "tbd";

export type SourceReleaseDate = {
  platform: string | null;
  /** e.g. "north_america", "europe", "japan", "worldwide". */
  region: string;
  date: Date | null;
  precision: DatePrecision;
  /** e.g. "Full Release", "Early Access"; null when unknown. */
  status: string | null;
};

/** Covers load straight from the IGDB image CDN, bypassing Next image optimization. */
export const coverUrl = (
  imageId: string,
  size: "cover_small" | "cover_big" | "cover_big_2x" = "cover_big",
) => `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
