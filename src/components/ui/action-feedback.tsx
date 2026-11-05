import { cn } from "cn";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

export type ActionState = "idle" | "pending" | "success" | "error";

/** Decorative state cue; the owning control or live region supplies its meaning. */
export function ActionIcon({
  icon,
  state = "idle",
}: {
  icon: ReactNode;
  state?: ActionState;
}) {
  return (
    <span
      aria-hidden="true"
      data-icon="inline-start"
      data-action-state={state}
      className="action-icon grid size-4 shrink-0 *:col-start-1 *:row-start-1 [&_svg]:size-full"
    >
      <span
        data-active={state === "idle"}
        style={{ opacity: state === "idle" ? 1 : 0 }}
      >
        {icon}
      </span>
      <span
        data-active={state === "pending"}
        style={{ opacity: state === "pending" ? 1 : 0 }}
      >
        <LoaderCircle
          className={
            state === "pending" ? "motion-safe:animate-spin" : undefined
          }
        />
      </span>
      <span
        data-active={state === "success"}
        style={{ opacity: state === "success" ? 1 : 0 }}
      >
        <Check />
      </span>
      <span
        data-active={state === "error"}
        style={{ opacity: state === "error" ? 1 : 0 }}
      >
        <CircleAlert />
      </span>
    </span>
  );
}

/** Visual feedback; use a single, stable live region in the owning flow. */
export function ActionFeedback({
  state,
  children,
  className,
}: {
  state: Exclude<ActionState, "idle">;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-sm",
        state === "error" ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      <ActionIcon state={state} icon={null} />
      <span>{children}</span>
    </span>
  );
}
