"use client";

import { ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import {
  positionBucket,
  resultsBucket,
  trackEvent,
} from "@/components/analytics";
import { GameCover } from "@/components/game-cover";
import { GameIdentificationMetadata } from "@/components/game-identification-metadata";
import { HomeCoverLink } from "@/components/home-cover-link";
import { TiltCover } from "@/components/tilt-cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SearchResult } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const MIN_QUERY = 2;
const INITIAL_RESULTS = 6;

/** What came back for one query and attempt; null results mean the search failed. */
type Answer = { q: string; attempt: number; results: SearchResult[] | null };

export function GameSearch({
  example,
  invitation,
  descriptionId,
}: {
  example?: ReactNode;
  invitation?: ReactNode;
  descriptionId?: string;
}) {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const year = searchParams.get("year") ?? "";
  const platform = searchParams.get("platform") ?? "";
  const expanded = searchParams.get("all") === "1";
  const filtersOpen = searchParams.get("filters") === "1";
  const activeFilters = Number(Boolean(year)) + Number(Boolean(platform));
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const q = query.trim();

  function updateSearch(values: Record<string, string>) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  useEffect(() => {
    if (q.length < MIN_QUERY) return;
    const controller = new AbortController();
    const debounce = setTimeout(async () => {
      let results: SearchResult[] | null = null;
      try {
        const res = await fetch(
          `/api/games/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(res.statusText);
        results = await res.json();
      } catch {}
      // A newer query or retry took over; its answer wins even if this one lands later.
      if (!controller.signal.aborted) setAnswer({ q, attempt, results });
    }, 300);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [q, attempt]);

  // Only the answer to exactly this query and attempt counts; anything else is still loading.
  const idle = q.length < MIN_QUERY;
  const current =
    !idle && answer?.q === q && answer.attempt === attempt ? answer : null;
  const results = current?.results;
  const failed = current && !results;
  const years = [
    ...new Set(
      results?.flatMap((game) => (game.year ? [game.year] : [])) ?? [],
    ),
  ].sort((a, b) => b - a);
  const platforms = [
    ...new Set(results?.flatMap((game) => game.platforms) ?? []),
  ].sort();
  const showYear =
    Boolean(year) ||
    (years.length > 0 &&
      (years.length > 1 ||
        Boolean(results?.some((game) => game.year === null))));
  const showPlatform =
    Boolean(platform) ||
    platforms.some((name) =>
      results?.some((game) => !game.platforms.includes(name)),
    );
  const matches = results?.filter(
    (game) =>
      (!year || String(game.year) === year) &&
      (!platform || game.platforms.includes(platform)),
  );

  const matched = matches?.length;

  // Once per settled answer or filter change; the query itself never leaves the browser.
  useEffect(() => {
    if (!current?.results || matched === undefined) return;
    trackEvent("game_searched", {
      results: resultsBucket(matched),
      filtered: Boolean(year || platform),
    });
  }, [current, matched, year, platform]);

  return (
    <div className="flex flex-col gap-4">
      <search
        aria-labelledby="game-search-label"
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <label
            id="game-search-label"
            htmlFor="game-search-input"
            className="font-medium"
          >
            Search games
          </label>
          <Input
            id="game-search-input"
            type="search"
            aria-describedby={descriptionId}
            placeholder="Search games…"
            value={query}
            onChange={(e) => {
              updateSearch({
                q: e.target.value,
                all: "",
                year: "",
                platform: "",
                filters: e.target.value && filtersOpen ? "1" : "",
              });
            }}
            className="h-11"
          />
        </div>
        <output
          aria-live="polite"
          className="text-muted-foreground text-sm empty:hidden"
        >
          {q.length === 1
            ? "Enter at least 2 characters"
            : idle || failed
              ? ""
              : !current
                ? "Searching…"
                : (year || platform) && matches?.length === 0
                  ? "No matches in these results. Clear filters or search for a more specific title."
                  : results?.length === 0
                    ? `No matches returned for “${q}”. Check the spelling or try different words from the title.`
                    : year || platform
                      ? `${matches?.length} of ${results?.length} returned matches ${matches?.length === 1 ? "fits" : "fit"} your filters.`
                      : `${results?.length} returned ${results?.length === 1 ? "match" : "matches"} for “${q}”.`}
        </output>
        {failed && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
          >
            <p>Search isn’t working right now. Your search is kept.</p>
            <Button
              variant="outline"
              className="h-11 sm:pointer-fine:h-8"
              onClick={() => setAttempt(attempt + 1)}
            >
              Try again
            </Button>
          </div>
        )}
        {(showYear || showPlatform) && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="min-h-11 sm:hidden"
                aria-expanded={filtersOpen}
                aria-controls="game-search-filters"
                onClick={() =>
                  updateSearch({ filters: filtersOpen ? "" : "1" })
                }
              >
                Filters{activeFilters > 0 ? ` (${activeFilters} active)` : ""}
                <ChevronDown aria-hidden="true" />
              </Button>
              {activeFilters > 0 && (
                <Button
                  variant="ghost"
                  className="min-h-11"
                  onClick={() =>
                    updateSearch({ year: "", platform: "", all: "" })
                  }
                >
                  Clear filters
                </Button>
              )}
            </div>
            <div
              id="game-search-filters"
              className={cn(
                "grid-cols-1 items-end gap-3 sm:grid sm:grid-cols-2",
                filtersOpen ? "grid" : "hidden",
              )}
            >
              {showYear && (
                <SearchFilter
                  id="game-search-year"
                  label="Release year"
                  value={year}
                  emptyLabel="All years"
                  options={years.map(String)}
                  onChange={(year) => updateSearch({ year, all: "" })}
                />
              )}
              {showPlatform && (
                <SearchFilter
                  id="game-search-platform"
                  label="Platform"
                  value={platform}
                  emptyLabel="All platforms"
                  options={platforms}
                  onChange={(platform) => updateSearch({ platform, all: "" })}
                />
              )}
            </div>
          </div>
        )}
        {(results || year || platform) && (
          <p
            id="game-search-filter-help"
            className="text-muted-foreground text-xs"
          >
            Search returns up to 50 candidates. Filters narrow these returned
            results only. Use a more specific title to find other games.
          </p>
        )}
        {matches && matches.length > 0 && (
          <ul
            id="game-search-results"
            aria-label="Search results"
            className="flex flex-col gap-2"
          >
            {(expanded ? matches : matches.slice(0, INITIAL_RESULTS)).map(
              (game, index) => (
                <li key={game.id} className="relative min-h-20 pl-[57px]">
                  <HomeCoverLink
                    gameId={game.id}
                    source="search"
                    event={[
                      "search_result_opened",
                      { position: positionBucket(index + 1) },
                    ]}
                    href={`/games/${game.slug}`}
                    title={game.title}
                    prefetch={true}
                    className="-mx-2 block min-h-11 rounded-md p-2 hover:bg-muted focus-visible:bg-muted"
                    cover={
                      <div
                        className="cover-entry absolute top-2 left-0"
                        style={
                          {
                            "--entry-delay": `${Math.min(index, 8) * 35}ms`,
                          } as CSSProperties
                        }
                      >
                        <TiltCover>
                          <GameCover
                            imageId={game.coverImageId}
                            size="cover_small"
                            className="w-[45px] rounded"
                          />
                        </TiltCover>
                      </div>
                    }
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-2 break-words font-medium leading-snug">
                        {game.title}
                      </p>
                    </div>
                  </HomeCoverLink>
                  <div className="pb-2">
                    <GameIdentificationMetadata
                      title={game.title}
                      year={game.year}
                      platforms={game.platforms}
                      selectedPlatform={platform}
                    />
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
        {matches && matches.length > INITIAL_RESULTS && (
          <Button
            variant="outline"
            className="h-11 self-start"
            aria-expanded={expanded}
            aria-controls="game-search-results"
            onClick={() => updateSearch({ all: expanded ? "" : "1" })}
          >
            {expanded
              ? "Show fewer matches"
              : `Show ${matches.length - INITIAL_RESULTS} more ${matches.length - INITIAL_RESULTS === 1 ? "match" : "matches"}`}
          </Button>
        )}
      </search>
      {(example || invitation) && (
        <div className="mt-2 flex flex-col gap-6 border-t pt-6">
          {invitation}
          {q.length === 0 && example}
        </div>
      )}
    </div>
  );
}

function SearchFilter({
  id,
  label,
  value,
  emptyLabel,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  emptyLabel: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const unavailable = value && !options.includes(value);
  const selectedLabel = value
    ? `${value}${unavailable ? " (not in these results)" : ""}`
    : emptyLabel;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-sm">
      <label htmlFor={id}>{label}</label>
      <div className="relative rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <div
          aria-hidden="true"
          className="pointer-events-none flex min-h-11 items-center gap-2 px-2 py-2 text-base"
        >
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            {selectedLabel}
          </span>
          <ChevronDown className="size-4 shrink-0" />
        </div>
        {/* Keep the native picker while allowing its visible value to wrap. */}
        <select
          id={id}
          value={value}
          aria-describedby="game-search-filter-help"
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          <option value="">{emptyLabel}</option>
          {unavailable && <option value={value}>{selectedLabel}</option>}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
