/** The external game catalog (IGDB). The real implementation is `igdb.ts`; tests use `src/test/fake-game-source.ts`. */
export interface GameSource {
  search(query: string): Promise<SourceGame[]>;
  fetchGame(id: number): Promise<SourceGame | null>;
  fetchReleaseDates(ids: number[]): Promise<Map<number, SourceReleaseDate[]>>;
}

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
  size: "cover_small" | "cover_big" = "cover_big",
) => `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
