"use client";

import { cn } from "cn";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const icon =
  "transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:scale-100";

export function CopyButton({
  text,
  inputId,
}: {
  text: string;
  inputId: string;
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
        onClick={async () => {
          if (busy.current) return;
          busy.current = true;
          clearTimeout(reset.current);
          setState("copying");
          try {
            await navigator.clipboard.writeText(text);
            setState("copied");
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
        <span aria-hidden className="grid *:col-start-1 *:row-start-1">
          <Copy className={cn(icon, copied && "scale-50 opacity-0")} />
          <Check className={cn(icon, !copied && "scale-50 opacity-0")} />
        </span>
        <span aria-live="polite">
          {copied ? "Copied" : state === "copying" ? "Copying…" : "Copy"}
        </span>
      </Button>
      {state === "failed" && (
        <p role="alert" className="basis-full text-destructive text-sm">
          Could not copy. Select the Calendar feed URL and copy it manually.
        </p>
      )}
    </>
  );
}
