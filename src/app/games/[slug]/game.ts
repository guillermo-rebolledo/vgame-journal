import { cacheLife, cacheTag } from "next/cache";
import { catalog } from "@/lib/catalog";
import { journal } from "@/lib/journal";

/** Shared by the page, its metadata and its share image, so one visit is one Catalog read. */
export async function findGame(slug: string) {
  "use cache";
  cacheLife("hours");
  return catalog.findBySlug(slug);
}

/** Expire with `updateTag` after a player's Rating write, so they see their own change. */
export const communityRatingTag = (gameId: number) =>
  `community-rating:${gameId}`;

/** Shared across players; other players' Ratings show up within minutes. Kept apart from `findGame` so it stays user-independent. */
export async function communityRating(gameId: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(communityRatingTag(gameId));
  return journal.communityRating(gameId);
}
