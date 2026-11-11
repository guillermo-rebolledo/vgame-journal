"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

/** Home promotion; preferences are saved by its authenticated server caller. */
export function ReviewInvitation({
  year,
  viewed,
  onDismiss,
}: {
  year: number;
  viewed: boolean;
  onDismiss: (duration: "session" | "year") => Promise<string | null>;
}) {
  const heading = useId();
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);

  function dismiss(duration: "session" | "year") {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const message = await onDismiss(duration);
        if (message) setError(message);
        else {
          setHidden(true);
          document.getElementById("home-journal-heading")?.focus();
        }
      } catch {
        setError("Couldn’t save your choice. Please try again.");
      } finally {
        busy.current = false;
      }
    });
  }

  if (hidden) return null;
  return (
    <section
      aria-labelledby={heading}
      className="space-y-3 rounded-lg border border-border bg-muted/40 p-4"
    >
      <div className="space-y-1">
        <h2 id={heading} className="font-medium text-lg">
          Your {year} in the Journal
        </h2>
        <p className="text-muted-foreground text-sm">
          Look back at the games you logged and the playing you recorded.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/year-in-review"
          prefetch={false}
          aria-label="Your year in the Journal · View"
          className={`${buttonVariants({ variant: "outline" })} min-h-11`}
        >
          View
        </Link>
        {viewed && (
          <>
            <Button
              variant="ghost"
              className="min-h-11"
              disabled={pending}
              onClick={() => dismiss("session")}
            >
              Dismiss
            </Button>
            <Button
              variant="ghost"
              className="min-h-11"
              disabled={pending}
              onClick={() => dismiss("year")}
            >
              Don’t show again
            </Button>
          </>
        )}
      </div>
      {viewed && (
        <p className="text-muted-foreground text-xs">
          Dismiss hides this banner until you sign out. Don’t show again hides
          it for {year} on all your devices.
        </p>
      )}
      <output aria-live="polite" className="text-sm text-muted-foreground">
        {pending ? "Saving your choice…" : error}
      </output>
    </section>
  );
}
