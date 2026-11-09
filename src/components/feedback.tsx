"use client";

import { MessageSquarePlus, Send } from "lucide-react";
import {
  type ComponentProps,
  type ReactNode,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { trackEvent } from "@/components/analytics";
import { ActionFeedback, ActionIcon } from "@/components/ui/action-feedback";
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
  renderTrigger,
  finalFocus,
}: {
  username?: string | null;
  onSubmit: SubmitFeedback;
  renderTrigger?: (open: () => void) => ReactNode;
  finalFocus?: ComponentProps<typeof DrawerContent>["finalFocus"];
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
      {renderTrigger ? (
        renderTrigger(() => changeOpen(true))
      ) : (
        <DrawerTrigger
          render={
            <Button
              variant="outline"
              press="static"
              size="sm"
              aria-label="Send feedback"
              className="min-h-11 min-w-11"
            />
          }
        >
          <MessageSquarePlus data-icon="inline-start" />
          <span className="hidden sm:inline">Feedback</span>
        </DrawerTrigger>
      )}
      <DrawerContent finalFocus={finalFocus}>
        <DrawerHeader className="mx-auto w-full max-w-xl">
          <DrawerTitle>
            {sent ? "Thanks, got it." : "Send feedback"}
          </DrawerTitle>
          <DrawerDescription>
            {sent
              ? "Your message was received. The team may reply to your account email."
              : "Something confusing, hard to use, or missing? Tell us about it."}
          </DrawerDescription>
        </DrawerHeader>
        <output
          aria-label="Feedback status"
          aria-live="polite"
          aria-atomic="true"
          className={sent ? "mx-auto w-full max-w-xl px-4 text-sm" : "sr-only"}
        >
          {sent ? (
            <ActionFeedback state="success">Feedback sent.</ActionFeedback>
          ) : pending ? (
            "Sending feedback…"
          ) : (
            ""
          )}
        </output>
        {sent ? (
          <div className="mx-auto flex w-full max-w-xl justify-end p-4">
            <DrawerClose render={<Button className="min-h-11" />}>
              Close
            </DrawerClose>
          </div>
        ) : (
          <form
            data-base-ui-swipe-ignore
            className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
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
              <p
                id={`${id}-guidance`}
                className="text-muted-foreground text-sm"
              >
                {type === "idea"
                  ? "What do you want to do, and how would it help?"
                  : type === "bug"
                    ? "What did you try, what happened, and what did you expect?"
                    : "Tell us about anything confusing or hard to use."}
              </p>
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
                  aria-describedby={`${id}-guidance ${id}-privacy${message.length >= 1800 ? ` ${id}-count` : ""}${error ? ` ${id}-error` : ""}`}
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
                <p
                  id={`${id}-error`}
                  role="alert"
                  className="text-destructive text-sm"
                >
                  {error}
                </p>
              )}
            </FieldGroup>
            <p id={`${id}-privacy`} className="text-muted-foreground text-sm">
              The team receives your message, username, opening page, and
              account reply address. Reports are private to the team and
              relevant processors. We may reply to your account email. Leave out
              passwords and private notes.
            </p>
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
                aria-busy={pending}
              >
                <ActionIcon
                  icon={<Send />}
                  state={pending ? "pending" : error ? "error" : "idle"}
                />
                <span className={pending ? "shimmer" : undefined}>Send</span>
              </Button>
            </div>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  );
}
