import { cacheLife } from "next/cache";
import { catalog } from "@/lib/catalog";

/** Shared by the page, its metadata and its share image, so one visit is one Catalog read. */
export async function findGame(slug: string) {
  "use cache";
  cacheLife("hours");
  return catalog.findBySlug(slug);
}
