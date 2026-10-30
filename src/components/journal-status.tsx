"use client";

import { Dialog } from "@base-ui/react/dialog";
import { BookMarked, LoaderCircle } from "lucide-react";
import { startTransition, useRef, useState } from "react";
import { trackEvent } from "@/components/analytics";
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
import type { JournalRemovalConfirmation } from "@/lib/journal";
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
export type SaveJournalStatus = (
  status: Status | null,
  tag: CompletionTag | null,
  acknowledged?: boolean,
) => Promise<{ error: string } | JournalRemovalConfirmation | undefined>;
export function JournalStatus({
  entry,
  gameTitle,
  playthroughCount,
  disabled,
  onSave,
}: {
  entry: JournalSelection;
  gameTitle: string;
  playthroughCount: number;
  disabled: boolean;
  onSave: SaveJournalStatus;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [confirmationCount, setConfirmationCount] = useState<number | null>(
    null,
  );
  const trigger = useRef<HTMLButtonElement | null>(null);
  const cancel = useRef<HTMLButtonElement | null>(null);
  const busy = useRef(false);
  function save(
    status: Status | null,
    tag: CompletionTag | null,
    acknowledged = false,
  ) {
    if (busy.current || disabled) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    startTransition(async () => {
      try {
        const result = await onSave(status, tag, acknowledged);
        if (result && "confirmationRequired" in result)
          setConfirmationCount(result.playthroughCount);
        else if (result) setError(result.error);
        else {
          setConfirmationCount(null);
          if (status === null) {
            setNotice(`${gameTitle} removed from your journal.`);
            trackEvent("journal_entry_removed", {
              had_playthroughs: playthroughCount > 0,
            });
          } else if (status !== entry?.status)
            trackEvent("journal_status_set", {
              status,
              change: entry ? "changed" : "added",
            });
          else if (tag && tag !== entry.completionTag)
            trackEvent("completion_tag_set", { tag });
        }
      } catch {
        setError(
          status === null
            ? "Couldn’t remove this game. Check your connection and try again."
            : "Couldn’t update your journal. Open Journal status to try again.",
        );
      } finally {
        busy.current = false;
        setPending(false);
      }
    });
  }
  return (
    <div>
      <DropdownMenu
        onOpenChange={(open, event) => {
          if (open && (disabled || pending)) event.cancel();
        }}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    ref={trigger}
                    aria-label="Journal status"
                    aria-description={
                      entry
                        ? `In your journal: ${entry.status}${entry.completionTag ? `, ${entry.completionTag}` : ""}`
                        : "Not in your journal"
                    }
                    aria-busy={pending}
                    aria-disabled={disabled || pending}
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
                  closeOnClick
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
                      closeOnClick
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
                  onClick={() => {
                    setError(undefined);
                    setNotice(undefined);
                    if (playthroughCount > 0)
                      setConfirmationCount(playthroughCount);
                    else save(null, null);
                  }}
                >
                  Remove from journal
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog.Root
        open={confirmationCount !== null}
        onOpenChange={(open, event) => {
          if (busy.current) event.cancel();
          else if (!open) {
            setConfirmationCount(null);
            setError(undefined);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Popup
            initialFocus={cancel}
            finalFocus={trigger}
            className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border bg-background p-6 text-foreground shadow-lg"
          >
            <Dialog.Title className="font-heading text-lg font-medium">
              Remove {gameTitle} from journal?
            </Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-sm">
              {gameTitle} has {confirmationCount}{" "}
              {confirmationCount === 1 ? "Playthrough" : "Playthroughs"}. If you
              remove it, all current Playthroughs and private notes will be
              permanently deleted.
            </Dialog.Description>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close
                render={
                  <Button
                    ref={cancel}
                    variant="outline"
                    disabled={pending}
                    className="h-auto min-h-11 max-w-full py-2 whitespace-normal"
                  />
                }
              >
                Cancel
              </Dialog.Close>
              <Button
                variant="destructive"
                disabled={pending}
                className="h-auto min-h-11 max-w-full py-2 whitespace-normal"
                onClick={() => save(null, null, true)}
              >
                {pending
                  ? "Removing…"
                  : error
                    ? "Retry removal"
                    : "Remove permanently"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      {notice && <output className="mt-2 block text-sm">{notice}</output>}
      {pending && <output className="sr-only">Saving journal status…</output>}
      {error && confirmationCount === null && (
        <p role="alert" className="mt-2 max-w-xs text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
