"use client";

import { BookMarked, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  COMPLETION_TAGS,
  type CompletionTag,
  STATUSES,
  type Status,
} from "@/lib/library";

export type JournalSelection = {
  status: Status;
  completionTag: CompletionTag | null;
} | null;
export function JournalStatus({
  entry,
  disabled,
  onSave,
}: {
  entry: JournalSelection;
  disabled: boolean;
  onSave: (
    status: Status | null,
    tag: CompletionTag | null,
  ) => Promise<{ error: string } | undefined>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function save(status: Status | null, tag: CompletionTag | null) {
    if (pending || disabled) return;
    setPending(true);
    setError(undefined);
    try {
      setError((await onSave(status, tag))?.error);
    } catch {
      setError(
        "Couldn’t update your journal. Open Journal status to try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    aria-label="Journal status"
                    aria-description={
                      entry
                        ? `In your journal: ${entry.status}${entry.completionTag ? `, ${entry.completionTag}` : ""}`
                        : "Not in your journal"
                    }
                    aria-busy={pending}
                    disabled={disabled || pending}
                    variant={entry ? "secondary" : "outline"}
                    size="icon"
                    className="size-11 rounded-full"
                  >
                    {pending ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <BookMarked fill={entry ? "currentColor" : "none"} />
                    )}
                  </Button>
                }
              />
            }
          />
          <TooltipContent>Journal status</TooltipContent>
        </Tooltip>
        <DropdownMenuContent className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Journal status</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={entry?.status ?? ""}>
              {STATUSES.map((status) => (
                <DropdownMenuRadioItem
                  key={status}
                  value={status}
                  className="min-h-10 capitalize"
                  disabled={pending}
                  onClick={() =>
                    save(
                      status,
                      status === "played"
                        ? (entry?.completionTag ?? null)
                        : null,
                    )
                  }
                >
                  {status}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          {entry?.status === "played" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Completion tag</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={entry.completionTag ?? "none"}>
                  {["none", ...COMPLETION_TAGS].map((tag) => (
                    <DropdownMenuRadioItem
                      key={tag}
                      value={tag}
                      className="min-h-10 capitalize"
                      disabled={pending}
                      onClick={() =>
                        save(
                          "played",
                          tag === "none" ? null : (tag as CompletionTag),
                        )
                      }
                    >
                      {tag === "none" ? "No tag" : tag}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </>
          )}
          {entry && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  className="min-h-10"
                  onClick={() => save(null, null)}
                >
                  Remove from journal
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {pending && <output className="sr-only">Saving journal status…</output>}
      {error && (
        <p role="alert" className="mt-2 max-w-xs text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
