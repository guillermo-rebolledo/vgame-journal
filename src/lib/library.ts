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
  /** Part of the title, ignoring case and accents. */
  query?: string;
  status?: Status;
  platform?: string;
  year?: number;
};

/** Grid or list; remembered in this cookie so the server renders the right one. */
export type LibraryView = "grid" | "list";
export const LIBRARY_VIEW_COOKIE = "library-view";

export const LIBRARY_SORTS = ["added", "released", "title"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

/** "backlog" → "Backlog", for Status and Completion tag labels. */
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A to Z, ignoring case and accents. */
export const byTitle = (a: { title: string }, b: { title: string }) =>
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

/** "Pokémon" → "pokemon". */
const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Entries matching every given filter, in the given order. */
export function queryLibrary(
  entries: LibraryEntry[],
  { query, status, platform, year }: LibraryFilters = {},
  sort: LibrarySort = "added",
) {
  const q = fold(query?.trim() ?? "");
  return entries
    .filter(
      (e) =>
        (!q || fold(e.title).includes(q)) &&
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

/** Library search, filters and sort from the URL (`?q=&status=&platform=&year=&sort=`); unknown values fall back to none. */
export function parseLibraryParams(params: Pick<URLSearchParams, "get">) {
  const status = params.get("status") as Status;
  const sort = params.get("sort") as LibrarySort;
  const year = Number(params.get("year"));
  const filters: LibraryFilters = {
    query: params.get("q") || undefined,
    status: STATUSES.includes(status) ? status : undefined,
    platform: params.get("platform") || undefined,
    year: Number.isInteger(year) && year > 0 ? year : undefined,
  };
  return { filters, sort: LIBRARY_SORTS.includes(sort) ? sort : "added" };
}

/** The query string for some filters and a sort, leaving out the defaults. */
export function libraryParams(filters: LibraryFilters, sort: LibrarySort) {
  const params = new URLSearchParams();
  const { query, status, platform, year } = filters;
  for (const [key, value] of [
    ["q", query],
    ["status", status],
    ["platform", platform],
    ["year", year],
    ["sort", sort === "added" ? undefined : sort],
  ] as const)
    if (value) params.set(key, String(value));
  return params.toString();
}
