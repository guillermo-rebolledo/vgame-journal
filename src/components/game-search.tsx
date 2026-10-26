"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useState, ViewTransition } from "react";
import { TiltCover } from "@/components/tilt-cover";
import { Input } from "@/components/ui/input";
import type { SearchResult } from "@/lib/catalog";
import { coverUrl } from "@/lib/game-source";

export function GameSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    const debounce = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/games/search?q=${encodeURIComponent(q)}`,
          {
            signal: controller.signal,
          },
        );
        if (!res.ok) throw new Error(res.statusText);
        setResults(await res.json());
        setFailed(false);
      } catch {
        if (controller.signal.aborted) return;
        setResults(null);
        setFailed(true);
      }
    }, 300);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        aria-label="Search games"
        placeholder="Search games…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-10"
      />
      <output aria-live="polite" className="text-muted-foreground text-sm">
        {failed
          ? "Search isn’t working right now. Try again in a moment."
          : results?.length === 0 && "No games found."}
      </output>
      {results && results.length > 0 && (
        <ul className="flex flex-col gap-2">
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
