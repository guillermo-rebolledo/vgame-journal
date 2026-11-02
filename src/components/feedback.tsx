"use client";

import { MessageSquarePlus } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { trackEvent } from "@/components/analytics";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FeedbackInput } from "@/lib/feedback";
import { FEEDBACK_TYPES, type FeedbackType } from "@/lib/feedback-types";
import { capitalize } from "@/lib/library";

export type SubmitFeedback = (
  input: FeedbackInput,
) => Promise<{ error: string } | undefined>;
const types = FEEDBACK_TYPES.map((value) => ({
  value,
  label: capitalize(value),
}));

export function Feedback({
  username,
  onSubmit,
}: {
  username?: string | null;
  onSubmit: SubmitFeedback;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("idea");
  const [message, setMessage] = useState("");
  const [path, setPath] = useState("/");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);
  if (!username) return null;

  function changeOpen(next: boolean) {
    if (saving.current) return;
    if (next) {
      setType("idea");
      setMessage("");
      setError(undefined);
      setSent(false);
      setPath(window.location.pathname);
    }
    setOpen(next);
  }

  return (
    <Drawer open={open} onOpenChange={changeOpen}>
      <DrawerTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="Send feedback"
            className="min-h-11 min-w-11"
          />
        }
      >
        <MessageSquarePlus data-icon="inline-start" />
        <span className="hidden sm:inline">Feedback</span>
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-xl">
        <DrawerHeader>
          <DrawerTitle>
            {sent ? "Thanks, got it." : "Send feedback"}
          </DrawerTitle>
          <DrawerDescription>
            {sent
              ? "Your feedback helps us improve Shelve."
              : "Have an idea or found a bug? Tell us about it."}
          </DrawerDescription>
        </DrawerHeader>
        {sent ? (
          <div className="flex justify-end p-4">
            <DrawerClose render={<Button className="min-h-11" />}>
              Close
            </DrawerClose>
          </div>
        ) : (
          <form
            data-base-ui-swipe-ignore
            className="flex flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onSubmit={(event) => {
              event.preventDefault();
              if (saving.current) return;
              saving.current = true;
              setError(undefined);
              startTransition(async () => {
                try {
                  const result = await onSubmit({ type, message, path });
                  if (result) setError(result.error);
                  else {
                    setSent(true);
                    trackEvent("feedback_submitted", { type });
                  }
                } catch {
                  setError(
                    "Couldn’t send. Check your connection and try again. Your message is still here.",
                  );
                } finally {
                  saving.current = false;
                }
              });
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${id}-type`}>Type</FieldLabel>
                <Select
                  items={types}
                  value={type}
                  onValueChange={(value) => setType(value ?? "idea")}
                  disabled={pending}
                >
                  <SelectTrigger id={`${id}-type`} className="min-h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {types.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor={`${id}-message`}>Message</FieldLabel>
                <textarea
                  id={`${id}-message`}
                  required
                  maxLength={2000}
                  rows={5}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  disabled={pending}
                  aria-invalid={!!error}
                  aria-describedby={
                    message.length >= 1800 ? `${id}-count` : undefined
                  }
                  className="rounded-lg border border-input bg-background px-3 py-2 text-base"
                />
                {message.length >= 1800 && (
                  <output
                    id={`${id}-count`}
                    aria-live="polite"
                    className="text-muted-foreground text-sm tabular-nums"
                  >
                    {message.length} / 2000
                  </output>
                )}
              </Field>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
            </FieldGroup>
            <div className="flex justify-end gap-3">
              <DrawerClose
                render={
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    disabled={pending}
                  />
                }
              >
                Cancel
              </DrawerClose>
              <Button
                type="submit"
                className="min-h-11"
                disabled={pending || !message.trim()}
              >
                {pending ? "Sending…" : "Send"}
              </Button>
            </div>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  );
}
