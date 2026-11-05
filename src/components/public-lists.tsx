"use client";

import Link from "next/link";
import { useState } from "react";
import { GameCover } from "@/components/game-cover";
import { PagedList, useUrlPagination } from "@/components/paged-list";
import { Button } from "@/components/ui/button";
import type { PublicList } from "@/lib/lists";

export function ListsUnavailable() {
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-3">
      <p role="alert">Lists are unavailable. Please try again.</p>
      <Button
        variant="outline"
        className="min-h-11"
        loading={pending}
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          setPending(true);
          // Reload also replaces streamed metadata from the failed read.
          window.location.reload();
        }}
      >
        {pending ? "Retrying lists…" : "Retry lists"}
      </Button>
    </div>
  );
}

export function PublicLists({ lists }: { lists: PublicList[] | null }) {
  const pagination = useUrlPagination("publicListPage", lists?.length);
  if (!lists) return <ListsUnavailable />;
  return (
    <section className="space-y-4" aria-label="Public collections">
      <h2 className="font-semibold text-xl">Public lists</h2>
      <p className="text-muted-foreground text-sm">
        {lists.length} public {lists.length === 1 ? "list" : "lists"}
      </p>
      {lists.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No public lists yet.
        </p>
      ) : (
        <PagedList items={lists} pagination={pagination} label="Public lists">
          {(visible) => (
            <ul
              aria-label="Public lists"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {visible.map((list) => (
                <li key={list.id} className="min-w-0">
                  <Link
                    href={`/u/${encodeURIComponent(list.creator.username ?? "")}/lists/${list.id}`}
                    className="flex h-full flex-col gap-3 rounded-lg border p-4 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <h3 className="font-semibold [overflow-wrap:anywhere]">
                      {list.title}
                    </h3>
                    {list.description && (
                      <p className="line-clamp-2 whitespace-pre-wrap text-muted-foreground text-sm [overflow-wrap:anywhere]">
                        {list.description}
                      </p>
                    )}
                    <div className="flex gap-2" aria-hidden="true">
                      {list.games.slice(0, 4).map((game) => (
                        <GameCover
                          key={game.gameId}
                          imageId={game.coverImageId}
                          size="cover_small"
                          className="w-10 rounded"
                        />
                      ))}
                    </div>
                    <p className="mt-auto text-muted-foreground text-sm">
                      {list.gameCount} {list.gameCount === 1 ? "game" : "games"}
                      {" · Updated "}
                      <time dateTime={new Date(list.updatedAt).toISOString()}>
                        {new Date(list.updatedAt).toLocaleDateString("en-US", {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        })}
                      </time>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PagedList>
      )}
    </section>
  );
}
