"use client";

import Link from "next/link";
import { GameCover } from "@/components/game-cover";
import { PagedList, useUrlPagination } from "@/components/paged-list";
import { SITE_URL } from "@/config/site";
import type { PublicList } from "@/lib/lists";

export function PublicListDetail({ list }: { list: PublicList }) {
  const pagination = useUrlPagination("listGamePage", list.games.length);
  const creatorPath = `/u/${encodeURIComponent(list.creator.username ?? "")}`;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="font-semibold text-3xl tracking-tight [overflow-wrap:anywhere]">
          {list.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          By{" "}
          <Link
            href={creatorPath}
            className="rounded underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            @{list.creator.username}
          </Link>
          {" · "}
          {list.gameCount} {list.gameCount === 1 ? "game" : "games"}
          {" · Updated "}
          <time dateTime={new Date(list.updatedAt).toISOString()}>
            {new Date(list.updatedAt).toLocaleDateString("en-US", {
              dateStyle: "medium",
              timeZone: "UTC",
            })}
          </time>
        </p>
        {list.description && (
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
            {list.description}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="public-list-url" className="font-medium text-sm">
          Public list URL
        </label>
        <input
          id="public-list-url"
          readOnly
          value={`${SITE_URL}${creatorPath}/lists/${list.id}`}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-muted-foreground text-sm">
          Select the URL to copy and share this public list.
        </p>
      </div>
      {list.games.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No games in this list yet.
        </p>
      ) : (
        <PagedList
          items={list.games}
          pagination={pagination}
          label="Public list games"
        >
          {(games, offset) => (
            <ol
              start={offset + 1}
              aria-label="List games"
              className="space-y-3"
            >
              {games.map((game, index) => (
                <li
                  key={game.gameId}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <span className="w-8 shrink-0 text-center text-muted-foreground text-sm tabular-nums">
                    {offset + index + 1}
                  </span>
                  <Link
                    href={`/games/${game.slug}`}
                    className="flex min-w-0 flex-1 items-center gap-4 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <GameCover
                      imageId={game.coverImageId}
                      size="cover_small"
                      className="w-12 rounded"
                    />
                    <span className="min-w-0 font-medium [overflow-wrap:anywhere]">
                      {game.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </PagedList>
      )}
    </div>
  );
}
