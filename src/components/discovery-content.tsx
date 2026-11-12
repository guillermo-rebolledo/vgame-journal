"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { GameCover } from "@/components/game-cover";
import { GameIdentificationMetadata } from "@/components/game-identification-metadata";
import { HomeCoverLink } from "@/components/home-cover-link";
import { HomeSaveControls } from "@/components/home-journal";
import { Button } from "@/components/ui/button";
import type { catalog } from "@/lib/catalog";

type Shelves = Awaited<ReturnType<typeof catalog.discovery>>;
export type DiscoveryResult = { shelves: Shelves } | { error: true };

export function DiscoveryError({
  retry,
  stale = false,
}: {
  retry: () => void;
  stale?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex min-h-28 flex-col items-start gap-3 rounded-lg border p-4">
      <output className="text-muted-foreground text-sm" aria-live="polite">
        {pending
          ? "Retrying discovery…"
          : stale
            ? "Discovery couldn’t be updated. Showing the last available picks. You can still search for a game."
            : "Discovery is unavailable. You can still search for a game or open your Journal."}
      </output>
      <Button
        variant="outline"
        className="min-h-11"
        loading={pending}
        disabled={pending}
        aria-busy={pending}
        onClick={() => startTransition(retry)}
      >
        Retry discovery
      </Button>
    </div>
  );
}

/** Refresh merges the payload into this mounted component, retaining its last successful read. */
export function DiscoveryContent({ result }: { result: DiscoveryResult }) {
  const router = useRouter();
  const instance = useId();
  const [snapshot, setSnapshot] = useState(result);
  if (result !== snapshot && "shelves" in result) setSnapshot(result);
  const shelves = "shelves" in snapshot ? snapshot.shelves : [];
  return (
    <div className="flex flex-col gap-6">
      {"error" in result && (
        <DiscoveryError
          retry={() => router.refresh()}
          stale={shelves.length > 0}
        />
      )}
      {shelves.map((shelf) => {
        const title =
          shelf.key === "recent" ? "Recently released" : "Recently trending";
        const id = `${instance}-${shelf.key}`;
        return (
          <section
            key={shelf.key}
            aria-labelledby={id}
            className="flex flex-col gap-3"
          >
            <h2 id={id} className="font-semibold text-xl">
              {title}
            </h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              {shelf.games.map((game) => (
                <li
                  key={game.id}
                  className="row-span-4 grid min-w-0 grid-rows-subgrid"
                >
                  <HomeCoverLink
                    gameId={game.id}
                    source="shelf"
                    event={[
                      "home_shelf_opened",
                      {
                        shelf:
                          shelf.key === "recent"
                            ? "recent_releases"
                            : "popular",
                      },
                    ]}
                    href={`/games/${game.slug}`}
                    className="group row-span-2 grid grid-rows-subgrid gap-2 rounded-lg outline-none"
                    cover={
                      <GameCover
                        imageId={game.coverImageId}
                        className="w-full rounded-lg shadow-lg"
                      />
                    }
                  >
                    <span className="break-words font-medium text-sm leading-snug group-hover:underline group-hover:underline-offset-4">
                      {game.title}
                    </span>
                  </HomeCoverLink>
                  <div className="min-w-0">
                    <GameIdentificationMetadata
                      title={game.title}
                      year={game.year}
                      platforms={game.platforms}
                    />
                  </div>
                  <HomeSaveControls game={{ ...game, gameId: game.id }} />
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">
              Updated{" "}
              <time dateTime={shelf.refreshedAt.toISOString()}>
                {shelf.refreshedAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </time>
            </p>
          </section>
        );
      })}
      {"shelves" in result && shelves.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No discovery picks yet—search for a game.
        </p>
      )}
    </div>
  );
}
