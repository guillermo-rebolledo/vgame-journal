"use client";

import { CalendarPlus, RotateCw } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { trackEvent } from "@/components/analytics";
import { CopyButton } from "@/components/copy-button";
import { ActionFeedback, ActionIcon } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CalendarFeedForm({
  url,
  onRegenerate,
}: {
  url: string;
  onRegenerate: () => Promise<{ saved: true } | { error: string }>;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ saved: true } | { error: string }>();
  const busy = useRef(false);
  return (
    <form
      aria-label="Calendar feed"
      className="flex min-w-0 flex-col gap-3 border-t pt-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy.current) return;
        busy.current = true;
        setResult(undefined);
        start(async () => {
          try {
            const saved = await onRegenerate();
            setResult(saved);
            if ("saved" in saved) trackEvent("calendar_feed_regenerated");
          } catch {
            setResult({
              error:
                "Couldn’t confirm the new Calendar feed URL. Refresh Settings and try again.",
            });
          } finally {
            busy.current = false;
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">Calendar feed</h2>
        <p className="text-muted-foreground text-sm">
          Subscribe in your calendar app to see wishlisted games on their
          release day. Only games with an exact date are included. Keep this URL
          private: anyone with it can read the feed without signing in,
          regardless of profile visibility.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          id="calendar-feed-url"
          readOnly
          value={url}
          aria-label="Calendar feed URL"
          className="min-w-0 flex-1 basis-48 font-mono text-xs md:text-xs"
        />
        <CopyButton
          key={url}
          text={url}
          inputId="calendar-feed-url"
          target="calendar"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="min-h-11"
          nativeButton={false}
          onClick={() => trackEvent("calendar_feed_subscribed")}
          render={
            <a href={url.replace(/^https?:/, "webcal:")}>
              <CalendarPlus aria-hidden="true" />
              Subscribe
            </a>
          }
        />
        <Button
          type="submit"
          variant="ghost"
          className="min-h-11"
          disabled={pending}
          aria-busy={pending}
        >
          <ActionIcon
            icon={<RotateCw />}
            state={
              pending
                ? "pending"
                : result && "error" in result
                  ? "error"
                  : "idle"
            }
          />
          <span className={pending ? "shimmer" : undefined}>
            Regenerate URL
          </span>
        </Button>
        <output aria-live="polite" aria-atomic="true" className="text-sm">
          {pending ? (
            "Regenerating…"
          ) : result && "saved" in result ? (
            <ActionFeedback state="success">Regenerated</ActionFeedback>
          ) : (
            ""
          )}
        </output>
      </div>
      {result && "error" in result && (
        <p role="alert" className="text-destructive text-sm">
          {result.error}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Regenerating stops the old URL working. Subscribe again with the new
        one. Calendar apps may keep events they already downloaded.
      </p>
    </form>
  );
}
