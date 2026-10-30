"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { REGIONS, type Region } from "@/lib/release-dates";

const REGION_LABELS: Record<Region, [label: string, hint: string]> = {
  earliest: ["Earliest worldwide", "The first release anywhere"],
  north_america: ["North America", "US and Canada release dates"],
  europe: ["Europe", "European release dates"],
  japan: ["Japan", "Japanese release dates"],
};

export function RegionForm({
  current,
  onSave,
}: {
  current: Region;
  onSave: (form: FormData) => Promise<{ saved: true } | { error: string }>;
}) {
  const [selection, setSelection] = useState(current);
  const [feedback, setFeedback] = useState<"saved" | "failed">();
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);

  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy.current) return;
        const form = new FormData(event.currentTarget);
        busy.current = true;
        setFeedback(undefined);
        startTransition(async () => {
          try {
            const result = await onSave(form);
            setFeedback("saved" in result ? "saved" : "failed");
          } catch {
            setFeedback("failed");
          } finally {
            busy.current = false;
          }
        });
      }}
    >
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-3">
        <legend className="mb-1 flex flex-col gap-1">
          <span className="font-medium">Release region</span>
          <span className="text-muted-foreground text-sm">
            Wishlist Countdowns follow release dates in this region. Games
            without a date there use the earliest one anywhere.
          </span>
        </legend>
        {REGIONS.map((region) => {
          const [label, hint] = REGION_LABELS[region];
          return (
            <label
              key={region}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-muted/50"
            >
              <input
                type="radio"
                name="region"
                value={region}
                checked={region === selection}
                onChange={() => {
                  setSelection(region);
                  setFeedback(undefined);
                }}
                className="size-4 shrink-0 accent-primary"
              />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-sm">{label}</span>
                <span className="text-muted-foreground text-sm">{hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <output aria-live="polite" className="text-muted-foreground text-sm">
        {pending ? "Saving…" : feedback === "saved" ? "Saved" : ""}
      </output>
      {feedback === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          Could not save your release region. Please try again.
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : feedback === "failed" ? "Retry" : "Save"}
      </Button>
    </form>
  );
}
