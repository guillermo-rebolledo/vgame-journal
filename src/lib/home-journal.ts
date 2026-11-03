import type { LibraryEntry, Status } from "@/lib/library";

export type HomeEntry = Pick<
  LibraryEntry,
  "gameId" | "title" | "slug" | "coverImageId" | "status"
>;
export type HomeSnapshot = {
  owner: string | null;
  entries: HomeEntry[] | null;
};
export const homeEntries = (entries: LibraryEntry[]): HomeEntry[] =>
  entries.map(({ gameId, title, slug, coverImageId, status }) => ({
    gameId,
    title,
    slug,
    coverImageId,
    status,
  }));
export const SAVED_LABELS: Record<Status, string> = {
  played: "Played",
  playing: "Playing",
  backlog: "In backlog",
  wishlist: "Wishlisted",
};
