"use client";

import { cn } from "cn";
import { RotateCw } from "lucide-react";
import { catchError } from "next/error";
import { type ReactNode, useState, useTransition } from "react";
import { RatingStars } from "@/components/rating-stars";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RatingSummary } from "@/lib/journal";
import { averagePoints, ratingRows } from "@/lib/rating";

const CARD =
  "col-span-full flex min-w-0 flex-col gap-1 rounded-lg border bg-background p-4 wrap-anywhere @max-[12rem]:p-2";

const ratings = (count: number) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? "Rating" : "Ratings"}`;

function Card({ children }: { children: ReactNode }) {
  return (
    <div className={CARD}>
      <dt className="text-muted-foreground text-sm">Community rating</dt>
      {children}
    </div>
  );
}

/** shelve.games players' Ratings for a game: the average once it meets the threshold, otherwise how many so far. */
export function CommunityRatingFact({ summary }: { summary: RatingSummary }) {
  const [pointerOpening, setPointerOpening] = useState(false);
  const { count, average, distribution } = summary;
  if (count === 0)
    return (
      <Card>
        <dd className="text-sm">No Ratings yet</dd>
      </Card>
    );
  if (average === null)
    return (
      <Card>
        <dd className="text-sm">{ratings(count)} so far</dd>
      </Card>
    );
  const max = Math.max(...distribution);
  return (
    <Card>
      <dd className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold text-3xl tabular-nums">
          {average.toFixed(1)}
        </span>
        <span className="text-muted-foreground text-sm">out of 5</span>
        {/* The average is already text; the stars only illustrate it. */}
        <span aria-hidden="true" className="self-center">
          <RatingStars points={averagePoints(average)} />
        </span>
      </dd>
      <dd className="text-muted-foreground text-xs tabular-nums">
        {ratings(count)}
      </dd>
      <dd className="mt-2 flex flex-col gap-2">
        <div
          role="img"
          aria-label="Distribution of Ratings from 0.5 to 5 stars. Exact values in View rating data."
          className="flex flex-col gap-1"
        >
          <div className="flex h-16 items-end gap-1">
            {distribution.map((value, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: the index is the Rating.
                key={index}
                className={cn(
                  "flex-1 rounded-t-sm bg-chart-2",
                  value === 0 && "h-0.5 bg-border",
                )}
                style={
                  value ? { height: `${(value / max) * 100}%` } : undefined
                }
              />
            ))}
          </div>
          <div
            aria-hidden="true"
            className="flex justify-between text-muted-foreground text-xs tabular-nums"
          >
            <span>0.5</span>
            <span>5</span>
          </div>
        </div>
        <details
          className="rating-data text-sm"
          data-pointer-open={pointerOpening}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: summary is a native keyboard-operable disclosure; click detail only selects its motion. */}
          <summary
            className="min-h-6 cursor-pointer underline-offset-4 hover:underline"
            onClick={(event) => setPointerOpening(event.detail > 0)}
          >
            View rating data
          </summary>
          <table className="mt-2 w-full text-left tabular-nums">
            <caption className="sr-only">Ratings per value</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-1 font-medium">
                  Rating
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Ratings
                </th>
              </tr>
            </thead>
            <tbody>
              {ratingRows(distribution).map(({ points, label, value }) => (
                <tr key={points} className="border-b">
                  <td className="py-1">{label}</td>
                  <td className="py-1 text-right">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </dd>
    </Card>
  );
}

/** Holds the Community rating's place while it streams in. */
export function CommunityRatingSkeleton() {
  return (
    <div className="col-span-full flex min-w-0">
      <dt className="sr-only">Community rating</dt>
      <dd className="flex min-w-0 flex-1">
        <output
          aria-label="Loading Community rating"
          className={cn(CARD, "flex-1")}
        >
          <span aria-hidden className="text-muted-foreground text-sm">
            Community rating
          </span>
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-4 w-20" />
        </output>
      </dd>
    </div>
  );
}

export function CommunityRatingUnavailable({ retry }: { retry?: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <Card>
      <dd className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <output aria-live="polite">
          {pending ? (
            <ActionFeedback state="pending">Retrying…</ActionFeedback>
          ) : (
            "Community rating unavailable"
          )}
        </output>
        {retry && (
          <Button
            variant="outline"
            className="min-h-11"
            loading={pending}
            onClick={() => startTransition(retry)}
          >
            {/* While loading, the Button's spinner takes the icon's place. */}
            {!pending && <RotateCw aria-hidden="true" />}
            Retry
          </Button>
        )}
      </dd>
    </Card>
  );
}

/** A failed Community rating read leaves the rest of the game page working. */
export const CommunityRatingBoundary = catchError((_props, { retry }) => (
  <CommunityRatingUnavailable retry={retry} />
));
