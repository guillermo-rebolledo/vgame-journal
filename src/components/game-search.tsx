"use client";

import { useSearchParams } from "next/navigation";
import { type CSSProperties, useEffect, useState } from "react";
import { GameCover } from "@/components/game-cover";
import { HomeCoverLink } from "@/components/home-cover-link";
import { PlatformNames } from "@/components/platform";
import { TiltCover } from "@/components/tilt-cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SearchResult } from "@/lib/catalog";

const MIN_QUERY = 2;
const INITIAL_RESULTS = 6;

/** What came back for one query and attempt; null results mean the search failed. */
type Answer = { q: string; attempt: number; results: SearchResult[] | null };

export function GameSearch() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const year = searchParams.get("year") ?? "";
  const platform = searchParams.get("platform") ?? "";
  const expanded = searchParams.get("all") === "1";
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
  const matches = results?.filter(
    (game) =>
      (!year || String(game.year) === year) &&
      (!platform || game.platforms.includes(platform)),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Input
          type="search"
          aria-label="Search games"
          aria-describedby="game-search-hint"
          placeholder="Search games…"
          value={query}
          onChange={(e) => {
            updateSearch({
              q: e.target.value,
              all: "",
              year: "",
              platform: "",
            });
          }}
          className="h-11"
        />
        <p id="game-search-hint" className="text-muted-foreground text-sm">
          Type at least {MIN_QUERY} characters of a game’s title.
        </p>
      </div>
      <output
        aria-live="polite"
        className="text-muted-foreground text-sm empty:hidden"
      >
        {idle || failed
          ? ""
          : !current
            ? "Searching…"
            : results?.length === 0
              ? `No games match “${q}”. Check the spelling, or try fewer or different words from the title.`
              : matches?.length === 0
                ? "No matches with these filters. Clear filters or try another year or platform."
                : `${matches?.length} ${matches?.length === 1 ? "game" : "games"} found.`}
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
      {results &&
        results.length > 0 &&
        (results.length > 1 || year || platform) && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
              <label htmlFor="game-search-year">Release year</label>
              <select
                id="game-search-year"
                value={year}
                onChange={(e) =>
                  updateSearch({ year: e.target.value, all: "" })
                }
                className="h-11 rounded-lg border border-input bg-background px-2 text-base focus-visible:outline-ring"
              >
                <option value="">All years</option>
                {year && !years.some((value) => String(value) === year) && (
                  <option value={year}>{year} (no matches)</option>
                )}
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
              <label htmlFor="game-search-platform">Platform</label>
              <select
                id="game-search-platform"
                value={platform}
                onChange={(e) =>
                  updateSearch({ platform: e.target.value, all: "" })
                }
                className="h-11 rounded-lg border border-input bg-background px-2 text-base focus-visible:outline-ring"
              >
                <option value="">All platforms</option>
                {platform && !platforms.includes(platform) && (
                  <option value={platform}>{platform} (no matches)</option>
                )}
                {platforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </div>
            {(year || platform) && (
              <Button
                variant="ghost"
                className="h-11"
                onClick={() =>
                  updateSearch({ year: "", platform: "", all: "" })
                }
              >
                Clear filters
              </Button>
            )}
            <p className="w-full text-muted-foreground text-xs">
              Filters narrow the returned matches. Refine the title to search
              further.
            </p>
          </div>
        )}
      {matches && matches.length > 0 && (
        <ul
          id="game-search-results"
          aria-label="Search results"
          className="flex flex-col gap-2"
        >
          {(expanded ? matches : matches.slice(0, INITIAL_RESULTS)).map(
            (game, index) => (
              <li key={game.id}>
                <HomeCoverLink
                  gameId={game.id}
                  source="search"
                  href={`/games/${game.slug}`}
                  title={game.title}
                  prefetch={true}
                  className="-mx-2 flex items-center gap-3 rounded-md p-2 hover:bg-muted focus-visible:bg-muted"
                  cover={
                    <div
                      className="cover-entry shrink-0"
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
                    <p className="mt-1 text-muted-foreground text-sm tabular-nums">
                      {game.year ?? "Release year TBA"}
                    </p>
                    <p className="line-clamp-2 text-muted-foreground text-sm">
                      <PlatformNames platforms={game.platforms} />
                    </p>
                  </div>
                </HomeCoverLink>
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
            : `Show all ${matches.length} matches`}
        </Button>
      )}
    </div>
  );
}
