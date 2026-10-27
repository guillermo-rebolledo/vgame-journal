"use client";

import { useActionState, useId, useState } from "react";
import { PlatformIcon } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Values = Record<string, string>;

/** Resolves to an error (with what was typed, to refill the form) or nothing. */
export type SavePlaythrough = (
  values: Values,
) => Promise<{ error: string } | undefined>;

const fieldClass = "flex flex-col gap-2";

/** Add or edit form for a Playthrough. The platform picker lists the game's platforms. */
export function PlaythroughForm({
  platforms,
  initial = {},
  submitLabel,
  onSave,
}: {
  platforms: string[];
  initial?: Values;
  submitLabel: string;
  onSave: SavePlaythrough;
}) {
  const id = useId();
  const [selectedPlatform, setSelectedPlatform] = useState(
    initial.platform ?? platforms[0] ?? "",
  );
  const [state, action, pending] = useActionState(
    async (_: unknown, form: FormData) => {
      const submitted = Object.fromEntries(form) as Values;
      const result = await onSave(submitted);
      setSelectedPlatform(
        result ? submitted.platform : (initial.platform ?? platforms[0] ?? ""),
      );
      return result && { ...result, values: submitted, at: Date.now() };
    },
    undefined,
  );
  // Form actions reset inputs; refill what was typed after an error.
  const values = state?.values ?? initial;

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className={fieldClass}>
        <Label htmlFor={`${id}-platform`}>Platform</Label>
        <div className="relative">
          {selectedPlatform && (
            <PlatformIcon
              platform={selectedPlatform}
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
          )}
          <select
            // The form reset doesn't re-apply a select's defaultValue; remount it after every error.
            key={state?.at}
            id={`${id}-platform`}
            name="platform"
            onChange={(event) => setSelectedPlatform(event.target.value)}
            required
            defaultValue={values.platform ?? platforms[0]}
            className="h-8 w-full rounded-lg border border-input bg-transparent pr-2 pl-8 text-base md:text-sm dark:bg-input/30"
          >
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className={fieldClass}>
          <Label htmlFor={`${id}-start`}>Started</Label>
          <Input
            id={`${id}-start`}
            name="startedOn"
            type="date"
            required
            defaultValue={values.startedOn}
          />
        </div>
        <div className={fieldClass}>
          <Label htmlFor={`${id}-end`}>Finished</Label>
          <Input
            id={`${id}-end`}
            name="endedOn"
            type="date"
            defaultValue={values.endedOn}
          />
        </div>
      </div>
      <div className={fieldClass}>
        <Label htmlFor={`${id}-hours`}>Hours</Label>
        <Input
          id={`${id}-hours`}
          name="hours"
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          defaultValue={values.hours}
          className="tabular-nums"
        />
      </div>
      <div className={fieldClass}>
        <Label htmlFor={`${id}-notes`}>Notes (private)</Label>
        <textarea
          id={`${id}-notes`}
          name="notes"
          rows={3}
          defaultValue={values.notes}
          className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base md:text-sm dark:bg-input/30"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
