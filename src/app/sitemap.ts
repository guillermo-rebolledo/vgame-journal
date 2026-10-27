import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { SITE_URL } from "@/config/site";
import { catalog } from "@/lib/catalog";

/** Dates are returned as ISO strings so the cached value stays plainly serializable. */
async function gameUrls() {
  "use cache";
  cacheLife("hours");
  const games = await catalog.indexedGames();
  return games.map(({ slug, syncedAt }) => ({
    url: `${SITE_URL}/games/${slug}`,
    lastModified: syncedAt.toISOString(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
}

/**
 * Home plus every game the Catalog knows. Public profiles are crawlable but left out
 * on purpose: listing them would publish a directory of members.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ...(await gameUrls()),
  ];
}
