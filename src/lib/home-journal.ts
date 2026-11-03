import type { WishlistEntry } from "@/lib/journal";
import type { LibraryEntry, Status } from "@/lib/library";
import type { ResolvedRelease } from "@/lib/release-dates";

export type HomeEntry = Pick<
  LibraryEntry,
  "gameId" | "title" | "slug" | "coverImageId" | "status" | "addedAt"
> & { release?: ResolvedRelease };
export type HomeSnapshot = {
  owner: string | null;
  entries: HomeEntry[] | null;
};
export const homeEntries = (
  entries: LibraryEntry[],
  wishlist: WishlistEntry[],
): HomeEntry[] =>
  entries.map(({ gameId, title, slug, coverImageId, status, addedAt }) => ({
    gameId,
    title,
    slug,
    coverImageId,
    status,
    addedAt,
    release: wishlist.find((entry) => entry.gameId === gameId)?.release,
  }));
export const SAVED_LABELS: Record<Status, string> = {
  played: "Played",
  playing: "Playing",
  backlog: "In backlog",
  wishlist: "Wishlisted",
};
