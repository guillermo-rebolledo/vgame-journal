"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useToday } from "@/components/use-today";
import type { WishlistEntry } from "@/lib/journal";
import { countdown, localDay, releasePhase } from "@/lib/release-dates";

/** A small view of the owner's already region-resolved, ordered Wishlist. */
export function HomeWishlistPreview({
  entries,
  renderControls,
}: {
  entries: WishlistEntry[];
  renderControls?: (entry: WishlistEntry) => ReactNode;
}) {
  const day = useToday();
  const sectionDay = day ?? localDay(new Date(), "UTC");
  const next =
    entries.find(
      (entry) => releasePhase(entry.release, sectionDay) === "upcoming",
    ) ??
    entries.find((entry) => releasePhase(entry.release, sectionDay) === "tba");
  if (!entries.length) return null;
  if (!next)
    return (
      <section
        aria-label="Wishlist release preview"
        className="rounded-lg border bg-muted/40 p-3 text-sm"
      >
        <Link
          href="/wishlist#wishlist-out"
          className="underline underline-offset-4"
        >
          {entries.length} Wishlist {entries.length === 1 ? "game" : "games"}{" "}
          out now
        </Link>
      </section>
    );
  const left = day && countdown(next.release, day);
  return (
    <section
      aria-label="Wishlist release preview"
      className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3 text-sm"
    >
      <p className="text-muted-foreground">Next on your Wishlist</p>
      <Link
        href={`/games/${next.slug}`}
        className="break-words font-medium underline underline-offset-4"
      >
        {next.title}
      </Link>
      <p className="text-muted-foreground tabular-nums">
        {next.release.date ? next.release.label : "Release date not announced"}
      </p>
      {left && <p className="font-medium tabular-nums">{left}</p>}
      {renderControls?.(next)}
    </section>
  );
}
