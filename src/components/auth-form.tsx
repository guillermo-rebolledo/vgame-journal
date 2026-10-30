"use client";

import { type ReactNode, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_GUIDANCE, PASSWORD_POLICY } from "@/lib/password-policy";

type Field = {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
};

/** Resolves to an error, a success message, or nothing (when it navigated away). */
export type Submit = (
  values: Record<string, string>,
) => Promise<{ error?: string; message?: string } | undefined>;

export function AuthForm({
  title,
  fields,
  submitLabel,
  onSubmit,
  children,
}: {
  title: string;
  fields: Field[];
  submitLabel: string;
  onSubmit: Submit;
  children?: ReactNode;
}) {
  const [state, action, pending] = useActionState(
    async (_: unknown, form: FormData) => {
      const values = Object.fromEntries(form) as Record<string, string>;
      const result = await onSubmit(values);
      const retainedValues = Object.fromEntries(
        fields
          .filter((field) => field.type !== "password")
          .map((field) => [field.name, values[field.name]]),
      );
      return { ...result, values: retainedValues };
    },
    undefined,
  );

  return (
    <section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
      {state?.message ? (
        <output className="enter">{state.message}</output>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          {fields.map((f) => (
            <div key={f.name} className="flex flex-col gap-2">
              <Label htmlFor={f.name}>{f.label}</Label>
              <Input
                id={f.name}
                name={f.name}
                type={f.type ?? "text"}
                autoComplete={f.autoComplete}
                {...(f.autoComplete === "new-password" ? PASSWORD_POLICY : {})}
                aria-describedby={
                  f.autoComplete === "new-password"
                    ? `${f.name}-guidance`
                    : undefined
                }
                // Form actions reset inputs; refill everything but passwords after an error.
                defaultValue={
                  f.type === "password" ? undefined : state?.values[f.name]
                }
                required
              />
              {f.autoComplete === "new-password" && (
                <p
                  id={`${f.name}-guidance`}
                  className="text-muted-foreground text-sm"
                >
                  {PASSWORD_GUIDANCE}
                </p>
              )}
            </div>
          ))}
          {state?.error && (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {submitLabel}
          </Button>
        </form>
      )}
      {children}
    </section>
  );
}
