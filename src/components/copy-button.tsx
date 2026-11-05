"use client";

import { cn } from "cn";
import { Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/components/analytics";
import { ActionIcon } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";

export function CopyButton({
  text,
  inputId,
  target,
}: {
  text: string;
  inputId: string;
  target: "profile" | "calendar" | "list";
}) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">(
    "idle",
  );
  const reset = useRef<ReturnType<typeof setTimeout>>(undefined);
  const busy = useRef(false);
  const copied = state === "copied";
  useEffect(() => () => clearTimeout(reset.current), []);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={state === "copying"}
        aria-busy={state === "copying"}
        onClick={async () => {
          if (busy.current) return;
          busy.current = true;
          clearTimeout(reset.current);
          setState("copying");
          try {
            await navigator.clipboard.writeText(text);
            setState("copied");
            trackEvent("link_copied", { target });
            reset.current = setTimeout(() => setState("idle"), 2000);
          } catch {
            setState("failed");
            const input = document.getElementById(inputId);
            if (input instanceof HTMLInputElement) {
              try {
                input.focus();
                input.select();
              } catch {
                // The read-only URL remains available for manual selection.
              }
            }
          } finally {
            busy.current = false;
          }
        }}
      >
        <ActionIcon
          icon={<Copy />}
          state={
            copied
              ? "success"
              : state === "copying"
                ? "pending"
                : state === "failed"
                  ? "error"
                  : "idle"
          }
        />
        <span
          aria-live="polite"
          className={cn(state === "copying" && "shimmer")}
        >
          {copied ? "Copied" : state === "copying" ? "Copying…" : "Copy"}
        </span>
      </Button>
      {state === "failed" && (
        <p role="alert" className="basis-full text-destructive text-sm">
          Could not copy. Select the{" "}
          {target === "calendar"
            ? "Calendar feed URL"
            : target === "list"
              ? "public list URL"
              : "public profile URL"}{" "}
          and copy it manually.
        </p>
      )}
    </>
  );
}
