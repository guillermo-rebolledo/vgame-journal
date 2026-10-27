"use client";

import { cn } from "cn";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const icon =
  "transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:scale-100";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <span aria-hidden className="grid *:col-start-1 *:row-start-1">
        <Copy className={cn(icon, copied && "scale-50 opacity-0")} />
        <Check className={cn(icon, !copied && "scale-50 opacity-0")} />
      </span>
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
}
