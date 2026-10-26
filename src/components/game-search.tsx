"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useState, ViewTransition } from "react";
import { TiltCover } from "@/components/tilt-cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SearchResult } from "@/lib/catalog";
import { coverUrl } from "@/lib/game-source";

const MIN_QUERY = 2;

/** What came back for one query and attempt; null results mean the search failed. */
type Answer = { q: string; attempt: number; results: SearchResult[] | null };

export function GameSearch() {
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const q = query.trim();

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Input
          type="search"
          aria-label="Search games"
          aria-describedby="game-search-hint"
          placeholder="Search games…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
              : `${results?.length} ${results?.length === 1 ? "game" : "games"} found.`}
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
      {results && results.length > 0 && (
        <ul aria-label="Search results" className="flex flex-col gap-2">
          {results.map((game, index) => (
            <li key={game.id}>
              <Link
                href={`/games/${game.slug}`}
                prefetch={true}
                className="-mx-2 flex items-center gap-3 rounded-md p-2 hover:bg-muted focus-visible:bg-muted"
              >
                <div
                  className="cover-entry"
                  style={
                    {
                      "--entry-delay": `${Math.min(index, 8) * 35}ms`,
                    } as CSSProperties
                  }
                >
                  <ViewTransition
                    name={`game-cover-${game.id}`}
                    default="none"
                    share="cover-morph"
                  >
                    <TiltCover>
                      {game.coverImageId ? (
                        // biome-ignore lint/performance/noImgElement: IGDB CDN serves sized covers; no Next image optimization.
                        <img
                          src={coverUrl(game.coverImageId, "cover_small")}
                          alt=""
                          width={45}
                          height={64}
                          loading="lazy"
                          className="h-16 w-[45px] shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="h-16 w-[45px] shrink-0 rounded bg-muted" />
                      )}
                    </TiltCover>
                  </ViewTransition>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {game.title}
                    {game.year && (
                      <span className="ml-2 text-muted-foreground">
                        {game.year}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-muted-foreground text-sm">
                    {game.platforms.join(", ")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
