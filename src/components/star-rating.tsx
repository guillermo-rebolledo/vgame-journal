"use client";

import { cn } from "cn";
import { RotateCw, Star } from "lucide-react";
import { useId, useRef, useState } from "react";
import { trackEvent } from "@/components/analytics";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Rating points, 1 (half a star) to 10 (5 stars). */
const POINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** "0.5 stars", "1 star", "3.5 stars". */
export const starsLabel = (points: number) =>
  `${points / 2} ${points === 2 ? "star" : "stars"}`;

const FAILED =
  "Couldn’t save your rating. Check your connection and try again.";

/** Five stars filled to `points` half stars. Decorative: callers supply the accessible text. */
export function Stars({
  points,
  className,
  starClassName = "size-4",
}: {
  points: number;
  className?: string;
  starClassName?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("inline-flex", className)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const halves = Math.min(Math.max(points - (star - 1) * 2, 0), 2);
        return (
          <span key={star} className={cn("relative shrink-0", starClassName)}>
            <Star
              strokeWidth={1.5}
              className="size-full text-muted-foreground"
            />
            {halves > 0 && (
              <Star
                strokeWidth={1.5}
                className="absolute inset-0 size-full fill-current text-foreground"
                style={
                  halves === 1 ? { clipPath: "inset(0 50% 0 0)" } : undefined
                }
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

export type SaveRating = (
  points: number | null,
) => Promise<{ error: string } | undefined>;

/**
 * The player's Rating for a game: ten native radios drawn as five half-star targets, plus Clear rating.
 * Shows a choice at once, saves one at a time so the last choice wins, and rolls back with a retry on failure.
 */
export function StarRating({
  value,
  editable,
  gameTitle,
  disabled = false,
  onSave,
}: {
  /** The saved Rating in points, or null. */
  value: number | null;
  /** Whether the Status allows giving a Rating (Played or Playing). Otherwise a kept Rating can only be cleared. */
  editable: boolean;
  gameTitle: string;
  disabled?: boolean;
  onSave: SaveRating;
}) {
  const [rating, setRating] = useState({ confirmed: value, shown: value });
  const [pending, setPending] = useState(false);
  const [previousValue, setPreviousValue] = useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    setRating((r) => ({ confirmed: value, shown: pending ? r.shown : value }));
  }
  const [error, setError] = useState<{
    message: string;
    retry: number | null;
  }>();
  const [notice, setNotice] = useState<string>();
  const name = useId();
  const group = useRef<HTMLFieldSetElement>(null);
  const inFlight = useRef(false);
  /** The latest choice made while a save was in flight; it goes next. */
  const queued = useRef<{ points: number | null }>(undefined);

  async function send(points: number | null, confirmed: number | null) {
    inFlight.current = true;
    setPending(true);
    let target = points;
    while (true) {
      let result: { error: string } | undefined;
      try {
        result = await onSave(target);
      } catch {
        result = { error: FAILED };
      }
      if (!result) {
        confirmed = target;
        const saved = target;
        setRating((r) => ({ ...r, confirmed: saved }));
      }
      const next = queued.current;
      queued.current = undefined;
      if (next && next.points !== confirmed) {
        target = next.points;
        continue;
      }
      inFlight.current = false;
      setPending(false);
      // The player moved back to the saved value meanwhile: nothing left to report.
      if (next) return;
      if (result) {
        setRating((r) => ({ ...r, shown: r.confirmed }));
        setError({ message: result.error, retry: target });
      } else if (target === null) {
        setNotice(`${gameTitle}: rating cleared.`);
        trackEvent("rating_cleared");
      } else {
        setNotice(`${gameTitle}: rated ${starsLabel(target)} out of 5.`);
        trackEvent("rating_set", { points: target });
      }
      return;
    }
  }

  function choose(points: number | null) {
    if (disabled) return;
    setError(undefined);
    setNotice(undefined);
    setRating((r) => ({ ...r, shown: points }));
    if (inFlight.current) queued.current = { points };
    else if (points !== rating.confirmed) send(points, rating.confirmed);
  }

  function clear() {
    choose(null);
    // Clear rating disappears with the Rating; keep focus in the control.
    if (editable) group.current?.querySelector("input")?.focus();
  }

  const status = (
    <output className="sr-only" aria-live="polite" aria-atomic="true">
      {pending ? "Saving rating…" : notice}
    </output>
  );
  if (!editable && rating.shown === null && !pending && !error) return status;

  return (
    <fieldset
      ref={group}
      aria-busy={pending}
      className="flex min-w-0 flex-col gap-1"
    >
      <legend className="mb-1 text-muted-foreground text-sm">
        Your rating
      </legend>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {editable ? (
          <div className="relative inline-flex">
            <Stars
              points={rating.shown ?? 0}
              starClassName="mx-2 my-1.5 size-8"
            />
            <div className="absolute inset-0 grid grid-cols-10">
              {POINTS.map((points) => (
                <label
                  key={points}
                  className="relative rounded-sm has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
                >
                  <input
                    type="radio"
                    name={name}
                    value={points}
                    aria-label={`${starsLabel(points)} out of 5`}
                    checked={rating.shown === points}
                    disabled={disabled}
                    onChange={() => choose(points)}
                    className="absolute inset-0 m-0 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
                  />
                </label>
              ))}
            </div>
          </div>
        ) : (
          rating.shown !== null && (
            <span
              role="img"
              aria-label={`Rated ${rating.shown / 2} out of 5`}
              className="inline-flex py-2"
            >
              <Stars points={rating.shown} starClassName="size-6" />
            </span>
          )
        )}
        {rating.shown !== null && (
          <Button
            variant="ghost"
            className="min-h-11"
            disabled={disabled}
            onClick={clear}
          >
            Clear rating
          </Button>
        )}
        {pending && (
          <span
            aria-hidden="true"
            className="flex items-center gap-2 text-muted-foreground text-sm"
          >
            <Spinner />
            <span className="shimmer">Saving…</span>
          </span>
        )}
      </div>
      {!editable && rating.shown !== null && (
        <p className="text-muted-foreground text-sm">
          Mark it Played or Playing to change your Rating.
        </p>
      )}
      {status}
      {error && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p role="alert" className="text-destructive text-sm">
            {error.message}
          </p>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={disabled}
            onClick={() => choose(error.retry)}
          >
            <RotateCw aria-hidden="true" />
            {error.retry === null
              ? "Retry clearing"
              : `Retry ${starsLabel(error.retry)}`}
          </Button>
        </div>
      )}
    </fieldset>
  );
}
