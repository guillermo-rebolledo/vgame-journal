"use client";

import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { coverUrl } from "@/lib/game-source";
import {
  LIBRARY_SORTS,
  LIBRARY_VIEW_COOKIE,
  type LibraryEntry,
  type LibraryFilters,
  type LibrarySort,
  type LibraryView,
  libraryChoices,
  queryLibrary,
  STATUSES,
} from "@/lib/library";

const SORT_LABELS: Record<LibrarySort, string> = {
  added: "Date added",
  released: "Release date",
  title: "Title",
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const statusLabel = (e: LibraryEntry) =>
  capitalize(e.status) +
  (e.completionTag ? ` · ${capitalize(e.completionTag)}` : "");

/** The user's Journal as a cover grid or compact list, filtered and sorted in place. */
export function Library({
  entries,
  initialView,
  readOnly = false,
}: {
  entries: LibraryEntry[];
  initialView: LibraryView;
  readOnly?: boolean;
}) {
  const [view, setView] = useState(initialView);
  const [filters, setFilters] = useState<LibraryFilters>({});
  const [sort, setSort] = useState<LibrarySort>("added");

  if (entries.length === 0 && readOnly)
    return (
      <p className="py-8 text-muted-foreground">
        No games in this library yet.
      </p>
    );

  if (entries.length === 0)
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
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

  const { platforms, years } = libraryChoices(entries);
  const shown = queryLibrary(entries, filters, sort);

  function choose(next: LibraryView) {
    setView(next);
    // biome-ignore lint/suspicious/noDocumentCookie: a sync one-liner; the Cookie Store API isn't in every browser yet.
    document.cookie = `${LIBRARY_VIEW_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
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
        <Select
          label="Year played"
          value={filters.year ? String(filters.year) : ""}
          onChange={(year) =>
            setFilters({ ...filters, year: year ? Number(year) : undefined })
          }
          options={[
            ["", "Any year"],
            ...years.map((y) => [String(y), String(y)] as const),
          ]}
        />
        <Select
          label="Sort by"
          value={sort}
          onChange={(s) => setSort(s as LibrarySort)}
          options={LIBRARY_SORTS.map((s) => [s, SORT_LABELS[s]] as const)}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {shown.length === entries.length
            ? `${entries.length} ${entries.length === 1 ? "game" : "games"}`
            : `${shown.length} of ${entries.length} games`}
        </p>
        <fieldset className="flex gap-1">
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
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
          <p className="font-medium">No games match these filters.</p>
          <Button
            variant="outline"
            className="h-11 sm:pointer-fine:h-8"
            onClick={() => setFilters({})}
          >
            Clear filters
          </Button>
        </div>
      ) : view === "grid" ? (
        <ul
          aria-label="Games"
          className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          {shown.map((e) => (
            <li key={e.gameId}>
              <Link
                href={`/games/${e.slug}`}
                className="group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Cover entry={e} className="w-full rounded-lg shadow-lg" />
                <div className="min-w-0">
                  <h2 className="line-clamp-2 font-medium text-sm leading-snug group-hover:underline group-hover:underline-offset-4">
                    {e.title}
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    {statusLabel(e)}
                  </p>
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
          {shown.map((e) => (
            <li key={e.gameId}>
              <Link
                href={`/games/${e.slug}`}
                className="-mx-2 flex items-center gap-3 rounded-md p-2 outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <Cover entry={e} size="cover_small" className="w-10 rounded" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-medium">
                    {e.title}
                    {e.releasedAt && (
                      <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                        {e.releasedAt.getUTCFullYear()}
                      </span>
                    )}
                  </h2>
                  {e.platforms.length > 0 && (
                    <p className="truncate text-muted-foreground text-sm">
                      {e.platforms.join(", ")}
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
      )}
    </div>
  );
}

function Cover({
  entry,
  size,
  className,
}: {
  entry: LibraryEntry;
  size?: "cover_small";
  className: string;
}) {
  return entry.coverImageId ? (
    // biome-ignore lint/performance/noImgElement: IGDB CDN serves sized covers; no Next image optimization.
    <img
      src={coverUrl(entry.coverImageId, size)}
      alt=""
      width={264}
      height={374}
      loading="lazy"
      className={`aspect-[264/374] shrink-0 object-cover ${className}`}
    />
  ) : (
    <div className={`aspect-[264/374] shrink-0 bg-muted ${className}`} />
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
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg sm:w-auto sm:pointer-fine:h-8 border border-input bg-transparent px-2 text-base md:text-sm dark:bg-input/30"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
