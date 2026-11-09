"use client";

import { Save } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { ActionFeedback, ActionIcon } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";
import type { ProfileVisibility } from "@/lib/journal";

const VISIBILITIES = ["private", "public"] as const;

const VISIBILITY_LABELS: Record<
  ProfileVisibility,
  [label: string, hint: string]
> = {
  private: ["Private", "Only you can open your profile"],
  public: ["Public", "Anyone can open your profile"],
};

export function ProfileVisibilityForm({
  current,
  onSave,
}: {
  current: ProfileVisibility;
  onSave: (form: FormData) => Promise<{ saved: true } | { error: string }>;
}) {
  const [selection, setSelection] = useState(current);
  const [feedback, setFeedback] = useState<"saved" | "failed">();
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);

  return (
    <form
      aria-label="Profile visibility"
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
          <span className="font-medium">Profile visibility</span>
          <span className="text-muted-foreground text-sm">
            Public profiles show your Library, Wishlist, Stats, and Playthrough
            dates, platforms and hours. Notes always stay private. List
            visibility is separate: Public Lists stay readable even when your
            profile is Private.
          </span>
        </legend>
        {VISIBILITIES.map((visibility) => {
          const [label, hint] = VISIBILITY_LABELS[visibility];
          return (
            <label
              key={visibility}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-muted/50"
            >
              <input
                type="radio"
                name="visibility"
                value={visibility}
                checked={visibility === selection}
                onChange={() => {
                  setSelection(visibility);
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
      {feedback === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          Could not save your profile visibility. Please try again.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="min-h-11"
        >
          <ActionIcon
            icon={<Save />}
            state={
              pending ? "pending" : feedback === "failed" ? "error" : "idle"
            }
          />
          <span className={pending ? "shimmer" : undefined}>
            {feedback === "failed" ? "Retry" : "Save"}
          </span>
        </Button>
        <output
          aria-live="polite"
          aria-atomic="true"
          className="min-h-5 text-sm"
        >
          {pending ? (
            "Saving…"
          ) : feedback === "saved" ? (
            <ActionFeedback state="success">Saved</ActionFeedback>
          ) : (
            ""
          )}
        </output>
      </div>
    </form>
  );
}
