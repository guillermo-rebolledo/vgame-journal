"use client";

import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useState, ViewTransition } from "react";
import { GameCover } from "@/components/game-cover";
import { PagedList, useUrlPagination } from "@/components/paged-list";
import { PlatformIcon, PlatformNames } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  capitalize,
  LIBRARY_SORTS,
  LIBRARY_VIEW_COOKIE,
  type LibraryEntry,
  type LibraryFilters,
  type LibrarySort,
  type LibraryView,
  libraryChoices,
  libraryParams,
  parseLibraryParams,
  queryLibrary,
  STATUSES,
} from "@/lib/library";

const SORT_LABELS: Record<LibrarySort, string> = {
  added: "Recently added",
  released: "Release date (newest first)",
  title: "Title (A–Z)",
};

const statusLabel = (e: LibraryEntry) =>
  capitalize(e.status) +
  (e.completionTag ? ` · ${capitalize(e.completionTag)}` : "");

/** Release year and Playthrough platforms, to tell games apart in either view. */
const releaseAndPlatforms = (e: LibraryEntry) => (
  <>
    {e.releasedAt?.getUTCFullYear()}
    {e.releasedAt && e.platforms.length > 0 && " · "}
    <PlatformNames platforms={e.platforms} />
  </>
);

/** The user's Journal as a cover grid or compact list, searched, filtered and sorted in place; all but the view live in the URL. */
export function Library({
  entries,
  initialView,
  readOnly = false,
}: {
  entries: LibraryEntry[];
  initialView: LibraryView;
  readOnly?: boolean;
}) {
  const searchParams = useSearchParams();
  const [view, setView] = useState(initialView);
  const urlQuery = searchParams.toString();
  const [query, setQuery] = useState(urlQuery);
  // Next restores native-history URLs in a transition; keep typing synchronous.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).toString() === urlQuery)
      setQuery(urlQuery);
  }, [urlQuery]);
  const state = parseLibraryParams(new URLSearchParams(query));

  const { filters: chosen, sort } = state;
  const deferredQuery = useDeferredValue(query);
  const deferredState = parseLibraryParams(new URLSearchParams(deferredQuery));

  const { platforms, years } = libraryChoices(entries);
  // A platform or year from an old link that no game has any more would hide everything.
  const filters: LibraryFilters = {
    ...chosen,
    platform: platforms.find((p) => p === chosen.platform),
    year: years.find((y) => y === chosen.year),
  };
  const resultFilters: LibraryFilters = {
    ...deferredState.filters,
    platform: platforms.find((p) => p === deferredState.filters.platform),
    year: years.find((y) => y === deferredState.filters.year),
  };
  const shown = queryLibrary(entries, resultFilters, deferredState.sort);
  const filtered = Object.values(filters).some(Boolean);

  const pagination = useUrlPagination(
    "libraryPage",
    urlQuery === deferredQuery ? shown.length : undefined,
  );

  if (entries.length === 0 && readOnly)
    return (
      <p className="py-8 text-muted-foreground">
        No games in this library yet.
      </p>
    );

  if (entries.length === 0)
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-4 sm:p-8">
        <p className="font-medium">Your library is empty.</p>
        <p className="text-muted-foreground text-sm">
          Search for a game you’ve played, are playing or want to play, and add
          it to your journal.
        </p>
        <Button render={<Link href="/" />} nativeButton={false}>
          Find a game
        </Button>
      </div>
    );

  // replaceState keeps one history entry while browsing; Next's router follows it.
  function update(next: { filters?: LibraryFilters; sort?: LibrarySort }) {
    const state = { filters: next.filters ?? filters, sort: next.sort ?? sort };
    const url = new URL(window.location.href);
    url.searchParams.delete("libraryPage");
    const nextParams = new URLSearchParams(
      libraryParams(state.filters, state.sort),
    );
    for (const key of ["q", "status", "platform", "year", "sort"]) {
      const value = nextParams.get(key);
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    setQuery(url.searchParams.toString());
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  const setFilters = (next: LibraryFilters) => update({ filters: next });

  function choose(next: LibraryView) {
    setView(next);
    // biome-ignore lint/suspicious/noDocumentCookie: a sync one-liner; the Cookie Store API isn't in every browser yet.
    document.cookie = `${LIBRARY_VIEW_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3 sm:flex sm:flex-wrap sm:items-end">
          <div className="col-span-full flex min-w-0 flex-col gap-1.5 sm:w-64">
            <Label htmlFor="library-search">Search your Library</Label>
            <Input
              id="library-search"
              type="search"
              placeholder="Title…"
              value={filters.query ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, query: e.target.value || undefined })
              }
              className="h-11 sm:pointer-fine:h-8"
            />
          </div>
          <Select
            label="Status"
            value={filters.status ?? ""}
            onChange={(status) =>
              setFilters({
                ...filters,
                status: (status || undefined) as LibraryFilters["status"],
              })
            }
            options={[
              ["", "All statuses"],
              ...STATUSES.map((s) => [s, capitalize(s)] as const),
            ]}
          />
          <Select
            label="Sort by"
            value={sort}
            onChange={(s) => update({ sort: s as LibrarySort })}
            options={LIBRARY_SORTS.map((s) => [s, SORT_LABELS[s]] as const)}
          />
        </div>
        {(platforms.length > 0 || years.length > 0) && (
          <details
            open={!!(filters.platform || filters.year) || undefined}
            className="group"
          >
            <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md text-muted-foreground text-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 sm:pointer-fine:min-h-8">
              More filters
              {(filters.platform || filters.year) && (
                <span className="ml-1 text-foreground">
                  ({[filters.platform, filters.year].filter(Boolean).length} on)
                </span>
              )}
            </summary>
            <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3 sm:flex sm:flex-wrap sm:items-end">
              {platforms.length > 0 && (
                <Select
                  label="Platform"
                  value={filters.platform ?? ""}
                  onChange={(platform) =>
                    setFilters({ ...filters, platform: platform || undefined })
                  }
                  options={[
                    ["", "All platforms"],
                    ...platforms.map((p) => [p, p] as const),
                  ]}
                />
              )}
              {years.length > 0 && (
                <Select
                  label="Year played"
                  value={filters.year ? String(filters.year) : ""}
                  onChange={(year) =>
                    setFilters({
                      ...filters,
                      year: year ? Number(year) : undefined,
                    })
                  }
                  options={[
                    ["", "Any year"],
                    ...years.map((y) => [String(y), String(y)] as const),
                  ]}
                />
              )}
            </div>
          </details>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3">
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {filtered
              ? `${shown.length} of ${entries.length} games`
              : `${entries.length} ${entries.length === 1 ? "game" : "games"}`}
          </p>
          {filtered && shown.length > 0 && (
            <ClearFilters onClick={() => setFilters({})} />
          )}
        </div>
        <fieldset className="flex flex-wrap gap-1">
          <legend className="sr-only">View</legend>
          {(
            [
              ["grid", "Grid", LayoutGrid],
              ["list", "List", List],
            ] as const
          ).map(([value, label, Icon]) => (
            <Button
              key={value}
              variant={view === value ? "secondary" : "ghost"}
              aria-pressed={view === value}
              className="h-11 sm:pointer-fine:h-8"
              onClick={() => choose(value)}
            >
              <Icon aria-hidden />
              {label}
            </Button>
          ))}
        </fieldset>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-4 sm:p-8">
          <p className="font-medium">No games match these filters.</p>
          <ClearFilters variant="outline" onClick={() => setFilters({})} />
        </div>
      ) : (
        <div aria-busy={query !== deferredQuery}>
          <PagedList
            pagination={pagination}
            items={shown}
            label="Library games"
          >
            {(visible) =>
              view === "grid" ? (
                <ul
                  aria-label="Games"
                  className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                >
                  {visible.map((e) => (
                    <li key={e.gameId}>
                      <Link
                        href={`/games/${e.slug}`}
                        transitionTypes={["open-game"]}
                        className="group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <ViewTransition
                          name={`game-cover-${e.gameId}`}
                          default="none"
                          // Filters and paging remount covers too; morph only when opening a game.
                          share={{
                            "open-game": "cover-morph",
                            default: "none",
                          }}
                        >
                          <GameCover
                            imageId={e.coverImageId}
                            className="w-full rounded-lg shadow-lg"
                          />
                        </ViewTransition>
                        <div className="min-w-0">
                          <h2 className="line-clamp-2 font-medium text-sm leading-snug group-hover:underline group-hover:underline-offset-4">
                            {e.title}
                          </h2>
                          <p className="text-muted-foreground text-xs">
                            {statusLabel(e)}
                          </p>
                          {(e.releasedAt || e.platforms.length > 0) && (
                            <p className="line-clamp-2 text-muted-foreground text-xs tabular-nums">
                              {releaseAndPlatforms(e)}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul
                  aria-label="Games"
                  className="flex flex-col divide-y divide-border/60"
                >
                  {visible.map((e) => (
                    <li key={e.gameId}>
                      <Link
                        href={`/games/${e.slug}`}
                        transitionTypes={["open-game"]}
                        className="-mx-2 flex flex-wrap items-center gap-3 sm:flex-nowrap rounded-md p-2 outline-none hover:bg-muted focus-visible:bg-muted"
                      >
                        <ViewTransition
                          name={`game-cover-${e.gameId}`}
                          default="none"
                          share={{
                            "open-game": "cover-morph",
                            default: "none",
                          }}
                        >
                          <GameCover
                            imageId={e.coverImageId}
                            size="cover_small"
                            className="w-10 rounded"
                          />
                        </ViewTransition>
                        <div className="min-w-0 flex-1 basis-40 sm:basis-auto">
                          <h2 className="truncate font-medium">
                            {e.title}
                            {e.releasedAt && (
                              <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                                {e.releasedAt.getUTCFullYear()}
                              </span>
                            )}
                          </h2>
                          {e.platforms.length > 0 && (
                            <p className="line-clamp-2 text-muted-foreground text-sm">
                              <PlatformNames platforms={e.platforms} />
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-muted-foreground text-sm">
                          {statusLabel(e)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            }
          </PagedList>
        </div>
      )}
    </div>
  );
}

/** Resets search and filters; sort and view stay as chosen. */
function ClearFilters({
  variant = "ghost",
  onClick,
}: {
  variant?: "ghost" | "outline";
  onClick: () => void;
}) {
  return (
    <Button
      variant={variant}
      className="h-11 sm:pointer-fine:h-8"
      onClick={onClick}
      title="Sort and view stay as they are"
    >
      Clear filters
    </Button>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [value: string, label: string])[];
}) {
  const id = `library-${label.toLowerCase().replace(/ /g, "-")}`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {label === "Platform" && value && (
          <PlatformIcon
            platform={value}
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
        )}
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 w-full rounded-lg sm:w-auto sm:pointer-fine:h-8 border border-input bg-transparent px-2 text-base md:text-sm dark:bg-input/30 ${label === "Platform" && value ? "pl-8" : ""}`}
        >
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
