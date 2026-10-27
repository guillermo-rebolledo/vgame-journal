"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUSES } from "@/lib/library";

type Values = Record<string, string>;
export type SavePlaythrough = (
  values: Values,
) => Promise<{ error: string } | undefined>;

export function PlaythroughForm({
  platforms,
  initial = {},
  outsideJournal = false,
  onSave,
  onSuccess,
  onCancel,
  onDraft,
  onPending,
  disabled = false,
}: {
  disabled?: boolean;
  platforms: string[];
  initial?: Values;
  outsideJournal?: boolean;
  onSave: SavePlaythrough;
  onSuccess: () => void;
  onCancel: () => void;
  onDraft: (values: Values) => void;
  onPending: (pending: boolean) => void;
}) {
  const id = useId();
  const [values, setValues] = useState<Values>({
    platform: platforms[0] ?? "",
    status: "playing",
    ...initial,
  });
  const [error, setError] = useState<string>();
  const [savingPending, setPending] = useState(false);
  const pending = savingPending || disabled;
  const saving = useRef(false);
  function change(name: string, value: string) {
    const next = { ...values, [name]: value };
    setValues(next);
    onDraft(next);
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    onPending(true);
    setError(undefined);
    try {
      const result = await onSave(values);
      if (result) setError(result.error);
      else onSuccess();
    } catch {
      setError(
        "Couldn’t save. Check your connection and try again. Your inputs are still here.",
      );
    } finally {
      saving.current = false;
      setPending(false);
      onPending(false);
    }
  }
  function picker(name: string, label: string, options: readonly string[]) {
    return (
      <Field>
        <FieldLabel htmlFor={`${id}-${name}`}>{label}</FieldLabel>
        <Select
          name={name}
          value={values[name] ?? ""}
          onValueChange={(value) => change(name, value ?? "")}
          disabled={pending}
          items={options.map((value) => ({ value, label: value }))}
        >
          <SelectTrigger
            id={`${id}-${name}`}
            className="h-11 w-full capitalize"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {options.map((value) => (
                <SelectItem
                  key={value}
                  value={value}
                  className="min-h-10 capitalize"
                >
                  {value}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    );
  }
  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
        <FieldGroup className="mx-auto max-w-xl">
          {outsideJournal && (
            <>
              <p className="text-muted-foreground text-sm">
                Save adds this game to your journal with the status you choose
                below.
              </p>
              {picker("status", "Journal status", STATUSES)}
            </>
          )}
          {platforms.length ? (
            picker("platform", "Platform", platforms)
          ) : (
            <p className="text-muted-foreground text-sm">
              This game has no platforms listed yet, so playthroughs can’t be
              logged.
            </p>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${id}-start`}>Started</FieldLabel>
              <Input
                id={`${id}-start`}
                type="date"
                required
                value={values.startedOn ?? ""}
                onChange={(e) => change("startedOn", e.target.value)}
                className="h-11"
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-end`}>Finished (optional)</FieldLabel>
              <Input
                id={`${id}-end`}
                type="date"
                value={values.endedOn ?? ""}
                onChange={(e) => change("endedOn", e.target.value)}
                className="h-11"
                disabled={pending}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`${id}-hours`}>Hours (optional)</FieldLabel>
            <Input
              id={`${id}-hours`}
              type="number"
              inputMode="decimal"
              min={0}
              max={99999}
              step={0.01}
              value={values.hours ?? ""}
              onChange={(e) => change("hours", e.target.value)}
              className="h-11 tabular-nums"
              disabled={pending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-notes`}>
              Notes (private, optional)
            </FieldLabel>
            <textarea
              id={`${id}-notes`}
              rows={4}
              value={values.notes ?? ""}
              onChange={(e) => change("notes", e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-base"
              disabled={pending}
            />
          </Field>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </FieldGroup>
      </div>
      <footer className="shrink-0 border-t bg-background px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-xl items-center justify-end gap-3">
          <output className="mr-auto text-muted-foreground text-sm">
            {pending ? "Saving…" : ""}
          </output>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="h-11 px-6"
            disabled={pending || !platforms.length}
          >
            Save
          </Button>
        </div>
      </footer>
    </form>
  );
}
