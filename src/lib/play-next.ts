import type {
  PlayNextFilters,
  RecommendationGame,
  RecommendationQuery,
  SourceReleaseDate,
} from "@/lib/game-source";
import { STANDALONE_TYPES } from "@/lib/game-source";

export type PlayNextSource = "backlog" | "discover";
export type PlayNextGame = {
  id: number;
  title: string;
  slug: string;
  coverImageId: string | null;
  genres: string[];
  platforms: string[];
  year: number | null;
  reason: string;
  series: number[];
  updatedAt: string | null;
};
export type PlayNextSnapshot = {
  owner: string;
  source: PlayNextSource;
  provenance: "backlog" | "related" | "popular";
  backlogCount: number;
  games: PlayNextGame[];
  bounded: boolean;
  platforms: string[];
  genres: string[];
};
export type PlayNextRequest = PlayNextFilters & {
  source?: PlayNextSource;
  popular?: boolean;
};
export type PlayNextRead = (
  owner: string,
  request: PlayNextRequest,
) => Promise<PlayNextSnapshot>;
export type PlayNextSave = (
  owner: string,
  game: Pick<PlayNextGame, "id" | "slug" | "updatedAt">,
  status: "backlog" | "playing",
) => Promise<{ error?: string; authRequired?: boolean }>;

/** URL state is only for this visit and sign-in continuation, never a saved preference. */
export function playNextHref(request: PlayNextRequest) {
  const params = new URLSearchParams();
  if (request.source) params.set("source", request.source);
  if (request.platform) params.set("platform", request.platform);
  if (request.genre) params.set("genre", request.genre);
  if (request.popular) params.set("popular", "1");
  return `/play-next${params.size ? `?${params}` : ""}`;
}

export function validPlayNextRequest(value: PlayNextRequest) {
  return (
    value &&
    (value.source === undefined ||
      value.source === "backlog" ||
      value.source === "discover") &&
    (value.popular === undefined || typeof value.popular === "boolean") &&
    [value.platform, value.genre].every(
      (filter) =>
        typeof filter === "string" &&
        filter.length <= 100 &&
        [...filter].every((character) => character.charCodeAt(0) >= 32),
    )
  );
}

export function releasedOn(
  game: {
    platforms: string[];
    genres: string[];
    releaseDates: SourceReleaseDate[];
  },
  filters: PlayNextFilters,
  now = new Date(),
) {
  return (
    (!filters.genre || game.genres.includes(filters.genre)) &&
    (!filters.platform || game.platforms.includes(filters.platform)) &&
    game.releaseDates.some(
      (date) =>
        date.date &&
        date.precision !== "tbd" &&
        date.date <= now &&
        (!filters.platform || date.platform === filters.platform),
    )
  );
}

/** Return a fresh shuffled copy: every Backlog game can appear, including large imports. */
export function shuffle<T>(values: T[]): T[] {
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Keep a series out of the batch twice while unrelated alternatives remain. */
export function nextBatch(pool: PlayNextGame[], seen: number[]) {
  const remaining = pool.filter((game) => !seen.includes(game.id));
  const batch: PlayNextGame[] = [];
  for (const game of remaining) {
    if (batch.length === 3) break;
    if (
      !game.series.some((id) =>
        batch.some((chosen) => chosen.series.includes(id)),
      )
    )
      batch.push(game);
  }
  for (const game of remaining) {
    if (batch.length === 3) break;
    if (!batch.includes(game)) batch.push(game);
  }
  return batch;
}

export function recommendationEvidence(
  candidate: RecommendationGame,
  seeds: RecommendationGame[],
) {
  const evidence = seeds.map((seed) => {
    const shared = (
      key:
        | "series"
        | "franchises"
        | "genres"
        | "themes"
        | "perspectives"
        | "modes",
    ) => candidate[key].some((id) => seed[key].includes(id));
    if (seed.similar.includes(candidate.game.id))
      return {
        rank: 4,
        reason: `Similar to ${seed.game.title} in your Backlog.`,
      };
    if (shared("series"))
      return {
        rank: 4,
        reason: `In a series with ${seed.game.title} in your Backlog.`,
      };
    const traits = (
      ["genres", "themes", "perspectives", "modes"] as const
    ).filter(shared);
    if (traits.length)
      return {
        rank: 2 + traits.length / 10,
        reason: `Shares ${traits.map((trait) => ({ genres: "a genre", themes: "a theme", perspectives: "a perspective", modes: "a game mode" })[trait]).join(" and ")} with ${seed.game.title} in your Backlog.`,
      };
    if (shared("franchises"))
      return {
        rank: 1,
        reason: `Shares a franchise with ${seed.game.title} in your Backlog.`,
      };
    return { rank: 0, reason: "" };
  });
  return evidence.sort((a, b) => b.rank - a.rank)[0] ?? { rank: 0, reason: "" };
}

export function recommendationQuery(
  seeds: RecommendationGame[],
  filters: PlayNextFilters,
  popular: boolean,
): RecommendationQuery {
  const values = (key: keyof Omit<RecommendationGame, "game">) =>
    [...new Set(seeds.flatMap((seed) => seed[key]))]
      .slice(0, 120)
      .sort((a, b) => a - b);
  return {
    ...filters,
    popular,
    similar: values("similar"),
    series: values("series"),
    franchises: values("franchises"),
    genres: values("genres"),
    themes: values("themes"),
    perspectives: values("perspectives"),
    modes: values("modes"),
  };
}

export const recommendationEligible = (
  candidate: RecommendationGame,
  filters: PlayNextFilters,
) =>
  STANDALONE_TYPES.has(candidate.game.type) &&
  !candidate.game.versionParent &&
  !candidate.game.fanMade &&
  !candidate.game.themes?.includes(42) &&
  releasedOn(candidate.game, filters);
