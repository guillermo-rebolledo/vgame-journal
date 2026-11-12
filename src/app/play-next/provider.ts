import { cacheLife } from "next/cache";
import { catalog } from "@/lib/catalog";
import type { RecommendationQuery } from "@/lib/game-source";

export async function recommendationSeeds(ids: number[]) {
  "use cache";
  cacheLife("hours");
  return catalog.playNextSeeds(ids);
}

export async function recommendationPage(
  query: RecommendationQuery,
  page: number,
) {
  "use cache";
  cacheLife("hours");
  return catalog.playNextPage(query, page);
}
