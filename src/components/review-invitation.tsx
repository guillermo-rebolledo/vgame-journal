"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { trackEvent } from "@/components/analytics";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Button, buttonVariants } from "@/components/ui/button";

const actionClass = "min-h-11 px-3 py-3 font-mono";

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
          trackEvent("year_in_review_invitation", {
            action: duration === "year" ? "hide" : "dismiss",
          });
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
      className="review-invitation grid grid-cols-[5.5rem_minmax(0,1fr)] gap-px overflow-hidden rounded-lg border border-keepsake-ink bg-keepsake-ink font-mono text-keepsake-ink sm:grid-cols-[8rem_minmax(0,1fr)]"
    >
      <p
        aria-hidden="true"
        className="flex items-center justify-center p-2 font-medium text-3xl text-keepsake-marker tracking-tighter sm:text-5xl"
      >
        {year}
      </p>
      <div className="space-y-2 bg-keepsake-paper p-4">
        <h2
          id={heading}
          className="font-medium text-sm uppercase tracking-wide"
        >
          Your {year} in the Journal
        </h2>
        <p className="text-sm leading-relaxed">
          Look back at the games you logged and the playing you recorded.
        </p>
      </div>
      <div
        className="review-invitation-actions col-span-2 grid gap-px"
        data-viewed={viewed}
      >
        <Link
          href="/year-in-review"
          prefetch={false}
          onClick={() =>
            trackEvent("year_in_review_invitation", { action: "view" })
          }
          aria-label="Your year in the Journal · View"
          className={buttonVariants({
            variant: "link",
            press: "static",
            className: `review-invitation-view ${actionClass}`,
          })}
        >
          View <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
        {viewed && (
          <>
            <Button
              variant="link"
              press="static"
              className={actionClass}
              disabled={pending}
              onClick={() => dismiss("session")}
            >
              Dismiss
            </Button>
            <Button
              variant="link"
              press="static"
              className={actionClass}
              disabled={pending}
              onClick={() => dismiss("year")}
            >
              Don’t show again
            </Button>
          </>
        )}
      </div>
      <output
        aria-live="polite"
        className={
          pending || error
            ? "col-span-2 bg-keepsake-paper px-4 py-3 text-sm"
            : "sr-only"
        }
      >
        {pending ? (
          <ActionFeedback state="pending">Saving your choice…</ActionFeedback>
        ) : (
          error
        )}
      </output>
    </section>
  );
}
