"use client";

import Link from "next/link";
import { useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { coverUrl } from "@/lib/game-source";
import type { WishlistEntry } from "@/lib/journal";
import { countdown, localDay, OUT_NOW, TODAY } from "@/lib/release-dates";

// Re-read the clock every minute so a Countdown ticks over at local midnight.
const everyMinute = (onChange: () => void) => {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
};
const today = () =>
  localDay(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);

/** The user's local calendar day; null while rendering on the server, which doesn't know their time zone. */
const useToday = () => useSyncExternalStore(everyMinute, today, () => null);

type Move = (gameId: number, status: "backlog" | "playing") => Promise<void>;

/** Wishlisted games with a live Countdown; released ones offer a move to Backlog or Playing. */
export function Wishlist({
  entries,
  onMove,
}: {
  entries: WishlistEntry[];
  onMove: Move;
}) {
  const day = useToday();

  if (entries.length === 0)
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
        <p className="font-medium">Your wishlist is empty.</p>
        <p className="text-muted-foreground text-sm">
          Find an upcoming game and set its status to Wishlist to count down to
          its release.
        </p>
        <Button render={<Link href="/" />} nativeButton={false}>
          Find a game
        </Button>
      </div>
    );

  return (
    <ul
      aria-label="Wishlist"
      className="flex flex-col divide-y divide-border/60"
    >
      {entries.map((e) => (
        <Row key={e.gameId} entry={e} day={day} onMove={onMove} />
      ))}
    </ul>
  );
}

function Row({
  entry,
  day,
  onMove,
}: {
  entry: WishlistEntry;
  day: string | null;
  onMove: Move;
}) {
  const [pending, startTransition] = useTransition();
  const { release } = entry;
  const left =
    release.precision === "day" && release.date && day
      ? countdown(release.date, day)
      : null;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
      <Link
        href={`/games/${entry.slug}`}
        className="group flex min-w-0 flex-1 basis-64 items-center gap-4 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {entry.coverImageId ? (
          // biome-ignore lint/performance/noImgElement: IGDB CDN serves sized covers; no Next image optimization.
          <img
            src={coverUrl(entry.coverImageId, "cover_small")}
            alt=""
            width={90}
            height={128}
            loading="lazy"
            className="aspect-[264/374] w-14 shrink-0 rounded object-cover shadow-md"
          />
        ) : (
          <div className="aspect-[264/374] w-14 shrink-0 rounded bg-muted" />
        )}
        {/* The Countdown sits under the date on phones, on the right from sm up. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="truncate font-medium group-hover:underline group-hover:underline-offset-4">
              {entry.title}
            </h2>
            <p className="text-muted-foreground text-sm tabular-nums">
              {release.label}
            </p>
          </div>
          {left && (
            <p
              className={`shrink-0 font-semibold tabular-nums sm:text-lg ${left === TODAY ? "text-primary sm:text-xl" : ""}`}
            >
              {left}
            </p>
          )}
        </div>
      </Link>

      {left === OUT_NOW && (
        <div className="flex items-center gap-2 pl-18 sm:pl-0">
          <span className="text-muted-foreground text-sm">Move to</span>
          {(["backlog", "playing"] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant="outline"
              disabled={pending}
              className="capitalize"
              aria-label={`Move ${entry.title} to ${status}`}
              onClick={() =>
                startTransition(() => onMove(entry.gameId, status))
              }
            >
              {status}
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}
