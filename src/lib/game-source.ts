/** The external game catalog (IGDB). The real implementation is `igdb.ts`; tests use `src/test/fake-game-source.ts`. */
export type PlayNextFilters = { platform: string; genre: string };
export type RecommendationGame = {
  game: SourceGame;
  similar: number[];
  series: number[];
  franchises: number[];
  genres: number[];
  themes: number[];
  perspectives: number[];
  modes: number[];
};
export type RecommendationQuery = PlayNextFilters & {
  similar: number[];
  series: number[];
  franchises: number[];
  genres: number[];
  themes: number[];
  perspectives: number[];
  modes: number[];
  popular: boolean;
};

export interface GameSource {
  fetchRecommendationSeeds(
    ids: number[],
    signal: AbortSignal,
  ): Promise<RecommendationGame[]>;
  fetchRecommendationPage(
    query: RecommendationQuery,
    page: number,
    signal: AbortSignal,
  ): Promise<{ games: RecommendationGame[]; hasMore: boolean }>;
  /** Next Visits page in descending score order, excluding all previously seen canonical IDs. */
  fetchDiscoveryRanks(
    excludedIds: number[],
    signal: AbortSignal,
  ): Promise<DiscoveryRankPage>;
  /** Recent first releases, including launches without reviews; Catalog applies activity and eligibility. */
  fetchRecentCandidates(
    afterId: number,
    from: Date,
    through: Date,
    signal: AbortSignal,
  ): Promise<{ games: SourceGame[]; hasMore: boolean }>;
  /** Visits only for the supplied candidate IDs; missing ranks remain missing. */
  fetchVisits(ids: number[], signal: AbortSignal): Promise<DiscoveryRank[]>;
  fetchTagGames(
    slug: string,
    limit: number,
    signal: AbortSignal,
  ): Promise<SourceGame[]>;
  fetchGames(ids: number[], signal: AbortSignal): Promise<SourceGame[]>;
  mapSteamApps(appids: number[], signal: AbortSignal): Promise<SteamMapping[]>;
  search(query: string): Promise<SourceGame[]>;
  fetchGame(id: number): Promise<SourceGame | null>;
  fetchBySlug(slug: string): Promise<SourceGame | null>;
  fetchReleaseDates(
    ids: number[],
    signal?: AbortSignal,
  ): Promise<Map<number, SourceReleaseDate[]>>;
}

export type DiscoveryRank = { gameId: number; visits: number };
export type DiscoveryRankPage = { ranks: DiscoveryRank[]; hasMore: boolean };
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

/** Standalone releases, including expanded games; versionParent separately excludes editions. */
export const STANDALONE_TYPES: ReadonlySet<GameType> = new Set([
  "main_game",
  "standalone_expansion",
  "remake",
  "expanded_game",
]);

export type SourceGame = {
  id: number;
  type: GameType;
  title: string;
  slug: string;
  summary: string | null;
  coverImageId: string | null;
  genres: string[];
  tags: string[];
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
  ageRatings: SourceAgeRating[];
  languages: SourceLanguage[];
};

/**
 * `board` is IGDB's organization name (ESRB, PEGI, CERO, USK, GRAC, CLASS_IND, ACB); `rating` its code, e.g. "T", "12", "MA 15+".
 * `board` is a plain string, not a union, because IGDB may send boards we don't know yet.
 */
export type SourceAgeRating = {
  board: string;
  rating: string;
  descriptors: string[];
};

export type SourceLanguage = {
  name: string;
  voices: boolean;
  subtitles: boolean;
  interface: boolean;
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

/** Most rated tag games first, with stable canonical-ID ties. */
export const compareTagGames = (
  a: Pick<SourceGame, "id" | "popularity">,
  b: Pick<SourceGame, "id" | "popularity">,
) => b.popularity - a.popularity || a.id - b.id;

export type SteamMapping = {
  appid: number;
  gameId: number;
  type: GameType;
  versionParent?: number | null;
  parentGame?: number | null;
};
