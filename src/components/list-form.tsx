"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import type { ListVisibility } from "@/lib/lists";

export function ListFields({
  title,
  description,
  onTitle,
  onDescription,
  disabled,
}: {
  title: string;
  description: string;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4">
      <label htmlFor={`${id}-title`} className="flex flex-col gap-2">
        List title
        <Input
          id={`${id}-title`}
          required
          maxLength={100}
          value={title}
          onChange={(e) => onTitle(e.target.value)}
        />
      </label>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-description`}>Description</label>
        <textarea
          id={`${id}-description`}
          aria-describedby={`${id}-help`}
          maxLength={2000}
          rows={4}
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <p id={`${id}-help`} className="text-muted-foreground text-sm">
        Optional, up to 2,000 characters. Plain text; line breaks are kept.
      </p>
    </fieldset>
  );
}

export function ListVisibilityFields({
  value,
  onChange,
}: {
  value: ListVisibility;
  onChange: (value: ListVisibility) => void;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">Visibility</legend>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="radio"
          name={`${id}-visibility`}
          checked={value === "private"}
          onChange={() => onChange("private")}
        />
        Private — only you
      </label>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="radio"
          name={`${id}-visibility`}
          checked={value === "public"}
          onChange={() => onChange("public")}
        />
        Public — anyone with the link, including signed-out visitors
      </label>
    </fieldset>
  );
}
