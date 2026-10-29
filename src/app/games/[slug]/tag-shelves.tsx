import { cacheLife } from "next/cache";
import { TagShelves } from "@/components/tag-shelves";
import { catalog } from "@/lib/catalog";

/** Shared by tag slug across game pages; exclude the current game after this lookup. */
async function findTagGames(slug: string) {
  "use cache";
  cacheLife("days");
  return catalog.tagGames(slug);
}

export async function GameTagShelves({
  game,
}: {
  game: { id: number; title: string; tags: string[] | null };
}) {
  const shelves = await catalog.tagShelves(game.id, game.tags, findTagGames);
  return shelves.length ? (
    <TagShelves key={game.id} title={game.title} shelves={shelves} />
  ) : null;
}
