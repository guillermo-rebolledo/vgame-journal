"use client";

import { useId } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ListVisibility } from "@/lib/lists";

export function ListFields({
  title,
  description,
  onTitle,
  onDescription,
  disabled,
  titleError,
}: {
  title: string;
  description: string;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  disabled?: boolean;
  titleError?: string;
}) {
  const id = useId();
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4">
      <Field data-invalid={Boolean(titleError)}>
        <FieldLabel htmlFor={`${id}-title`}>List title</FieldLabel>
        <Input
          id={`${id}-title`}
          name="title"
          required
          maxLength={100}
          value={title}
          aria-invalid={Boolean(titleError)}
          aria-describedby={titleError ? `${id}-title-error` : undefined}
          onChange={(e) => onTitle(e.target.value)}
        />
        {titleError && (
          <FieldError id={`${id}-title-error`}>{titleError}</FieldError>
        )}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-description`}>
          Description (optional)
        </FieldLabel>
        <textarea
          id={`${id}-description`}
          aria-describedby={`${id}-help`}
          maxLength={2000}
          rows={3}
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
        />
        <FieldDescription id={`${id}-help`}>
          Up to 2,000 characters.
        </FieldDescription>
      </Field>
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
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 font-medium">Visibility</legend>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="radio"
          name={`${id}-visibility`}
          className="accent-primary"
          checked={value === "private"}
          onChange={() => onChange("private")}
        />
        Private — only you
      </label>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="radio"
          name={`${id}-visibility`}
          className="accent-primary"
          checked={value === "public"}
          onChange={() => onChange("public")}
        />
        Public — visible to anyone and listed on your profile
      </label>
    </fieldset>
  );
}
