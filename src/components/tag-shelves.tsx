"use client";

import { type CSSProperties, useId, useState } from "react";
import { GameCover } from "@/components/game-cover";
import {
  HomeCoverLink,
  HomeCoverTransitions,
} from "@/components/home-cover-link";
import type { TagShelf } from "@/lib/game-tags";

/** Every shelf is already loaded; choosing a tag is an immediate local swap. */
export function TagShelves({
  title,
  shelves,
}: {
  title: string;
  shelves: TagShelf[];
}) {
  const [selected, select] = useState(shelves[0]?.tag.slug);
  const headingId = useId();
  const shelf = shelves.find((s) => s.tag.slug === selected) ?? shelves[0];
  if (!shelf) return null;
  return (
    <section
      aria-labelledby={headingId}
      className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4 px-4 pt-4 pb-12"
    >
      <h2 id={headingId} className="font-semibold text-xl">
        More like {title}
      </h2>
      <fieldset
        aria-label="Show games tagged"
        className="-mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
      >
        {shelves.map(({ tag }) => (
          <button
            key={tag.slug}
            type="button"
            aria-pressed={shelf.tag.slug === tag.slug}
            onClick={() => select(tag.slug)}
            className="group inline-flex min-h-11 shrink-0 items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:active:scale-[0.97] motion-safe:transition-[background-color,color,border-color,transform] motion-safe:duration-150 motion-safe:ease-out"
          >
            <span className="inline-flex h-8 items-center rounded-full border border-border/80 bg-background/50 px-3 text-sm transition-colors duration-150 ease-out group-hover:bg-accent group-aria-pressed:border-foreground group-aria-pressed:bg-foreground group-aria-pressed:text-background">
              {tag.label}
            </span>
          </button>
        ))}
      </fieldset>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        Most rated games tagged {shelf.tag.label}
      </p>
      <HomeCoverTransitions>
        <ul
          key={shelf.tag.slug}
          className="grid grid-cols-3 gap-4 sm:grid-cols-6"
        >
          {shelf.games.map((game, index) => (
            <li
              key={game.id}
              className="cover-entry min-w-0"
              style={{ "--entry-delay": `${25 * index}ms` } as CSSProperties}
            >
              <HomeCoverLink
                gameId={game.id}
                source="shelf"
                href={`/games/${game.slug}`}
                className="group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5"
                cover={
                  <GameCover
                    imageId={game.coverImageId}
                    className="w-full rounded-lg shadow-lg"
                  />
                }
              >
                <span className="line-clamp-2 font-medium text-sm leading-snug group-hover:underline group-hover:underline-offset-4">
                  {game.title}
                </span>
              </HomeCoverLink>
            </li>
          ))}
        </ul>
      </HomeCoverTransitions>
    </section>
  );
}
