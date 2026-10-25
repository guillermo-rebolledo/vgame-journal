// Journal terms and Library filters and sorts. No database here, so the Library view runs the same rules in the browser.

export const STATUSES = ["played", "playing", "backlog", "wishlist"] as const;
export type Status = (typeof STATUSES)[number];

export const COMPLETION_TAGS = [
  "completed",
  "retired",
  "shelved",
  "abandoned",
] as const;
export type CompletionTag = (typeof COMPLETION_TAGS)[number];

export type LibraryEntry = {
  gameId: number;
  title: string;
  slug: string;
  coverImageId: string | null;
  status: Status;
  completionTag: CompletionTag | null;
  addedAt: Date;
  /** Earliest known release, or null if TBA. */
  releasedAt: Date | null;
  /** Platforms of the entry's Playthroughs. */
  platforms: string[];
  /** Years any Playthrough covers; an ongoing one runs to this year. */
  years: number[];
};

export type LibraryFilters = {
  status?: Status;
  platform?: string;
  year?: number;
};

/** Grid or list; remembered in this cookie so the server renders the right one. */
export type LibraryView = "grid" | "list";
export const LIBRARY_VIEW_COOKIE = "library-view";

export const LIBRARY_SORTS = ["added", "released", "title"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

const byTitle = (a: LibraryEntry, b: LibraryEntry) =>
  a.title.localeCompare(b.title, "en", { sensitivity: "base" });

/** Newest first for both dates; undated releases last. Ties go by title. */
const compare: Record<
  LibrarySort,
  (a: LibraryEntry, b: LibraryEntry) => number
> = {
  added: (a, b) => b.addedAt.getTime() - a.addedAt.getTime() || byTitle(a, b),
  released: (a, b) =>
    (b.releasedAt?.getTime() ?? -Infinity) -
      (a.releasedAt?.getTime() ?? -Infinity) || byTitle(a, b),
  title: byTitle,
};

/** Entries matching every given filter, in the given order. */
export function queryLibrary(
  entries: LibraryEntry[],
  { status, platform, year }: LibraryFilters = {},
  sort: LibrarySort = "added",
) {
  return entries
    .filter(
      (e) =>
        (!status || e.status === status) &&
        (!platform || e.platforms.includes(platform)) &&
        (!year || e.years.includes(year)),
    )
    .sort(compare[sort]);
}

/** The platforms and years that appear in the entries, for filter choices. */
export function libraryChoices(entries: LibraryEntry[]) {
  return {
    platforms: [...new Set(entries.flatMap((e) => e.platforms))].sort(),
    years: [...new Set(entries.flatMap((e) => e.years))].sort((a, b) => b - a),
  };
}
