"use client";

import { Dialog } from "@base-ui/react/dialog";
import { BookMarked, ChevronDown, Trash2 } from "lucide-react";
import { type ReactNode, startTransition, useRef, useState } from "react";
import { trackEvent } from "@/components/analytics";
import { ActionIcon } from "@/components/ui/action-feedback";
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
import { SAVED_LABELS } from "@/lib/home-journal";
import type { JournalRemovalConfirmation } from "@/lib/journal";
import {
  COMPLETION_TAGS,
  type CompletionTag,
  capitalize,
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
  rated = false,
  disabled,
  onSave,
  actions,
}: {
  entry: JournalSelection;
  gameTitle: string;
  playthroughCount: number;
  /** Whether the entry has a Rating, which removal also deletes. */
  rated?: boolean;
  disabled: boolean;
  onSave: SaveJournalStatus;
  actions?: ReactNode;
}) {
  const [confirmed, setConfirmed] = useState(entry);
  const [previousEntry, setPreviousEntry] = useState(entry);
  if (entry !== previousEntry) {
    setPreviousEntry(entry);
    setConfirmed(entry);
  }
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  /** What removal will delete, while its confirmation is open. */
  const [confirmation, setConfirmation] = useState<Omit<
    JournalRemovalConfirmation,
    "confirmationRequired"
  > | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const cancel = useRef<HTMLButtonElement | null>(null);
  const busy = useRef(false);
  const label = confirmed
    ? `${SAVED_LABELS[confirmed.status]}${confirmed.completionTag ? ` · ${capitalize(confirmed.completionTag)}` : ""}`
    : "Add to Journal";
  function save(
    status: Status | null,
    tag: CompletionTag | null,
    acknowledged = false,
  ) {
    if (busy.current || disabled) return;
    if (status === confirmed?.status && tag === confirmed.completionTag) {
      setNotice(undefined);
      setError(undefined);
      return;
    }
    busy.current = true;
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    startTransition(async () => {
      try {
        const result = await onSave(status, tag, acknowledged);
        if (result && "confirmationRequired" in result) setConfirmation(result);
        else if (result) setError(result.error);
        else {
          setConfirmation(null);
          setConfirmed(status === null ? null : { status, completionTag: tag });
          if (status === null) {
            setNotice(`${gameTitle} removed from your journal.`);
            trackEvent("journal_entry_removed", {
              had_playthroughs: playthroughCount > 0,
            });
          } else if (status !== confirmed?.status) {
            setNotice(`${gameTitle}: ${SAVED_LABELS[status]}.`);
            trackEvent("journal_status_set", {
              status,
              change: confirmed ? "changed" : "added",
            });
          } else if (tag !== confirmed.completionTag) {
            setNotice(
              `${gameTitle}: ${tag ? capitalize(tag) : "Completion tag cleared"}.`,
            );
            if (tag) trackEvent("completion_tag_set", { tag });
          }
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
      <fieldset
        aria-label="Game actions"
        className="flex min-w-0 flex-wrap items-start gap-3"
      >
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <DropdownMenu
            onOpenChange={(open, event) => {
              if (open && (disabled || pending)) event.cancel();
            }}
          >
            <Tooltip disabled={confirmation !== null}>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        ref={trigger}
                        press="static"
                        aria-label={`${label}${confirmed ? " — Change Journal status" : ""} for ${gameTitle}`}
                        aria-description={
                          confirmed
                            ? `In your journal: ${confirmed.status}${confirmed.completionTag ? `, ${confirmed.completionTag}` : ""}`
                            : "Not in your journal"
                        }
                        aria-busy={pending}
                        aria-disabled={disabled || pending}
                        variant={confirmed ? "secondary" : "outline"}
                        className="journal-action min-h-11"
                      >
                        <ActionIcon
                          icon={
                            <BookMarked
                              fill={confirmed ? "currentColor" : "none"}
                            />
                          }
                          state={pending ? "pending" : "idle"}
                        />
                        <span className={pending ? "shimmer" : undefined}>
                          {label}
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          data-icon="inline-end"
                        />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent>Journal status</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="journal-status-menu w-60">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Journal status</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={confirmed?.status ?? ""}>
                  {STATUSES.map((status) => (
                    <DropdownMenuRadioItem
                      closeOnClick
                      key={status}
                      value={status}
                      className="min-h-11 capitalize"
                      disabled={pending}
                      onClick={() =>
                        save(
                          status,
                          status === "played"
                            ? (confirmed?.completionTag ?? null)
                            : null,
                        )
                      }
                    >
                      {status}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              {confirmed?.status === "played" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Completion tag</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={confirmed.completionTag ?? "none"}
                    >
                      {["none", ...COMPLETION_TAGS].map((tag) => (
                        <DropdownMenuRadioItem
                          closeOnClick
                          key={tag}
                          value={tag}
                          className="min-h-11 capitalize"
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
              {confirmed && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      className="min-h-10"
                      onClick={() => {
                        setError(undefined);
                        setNotice(undefined);
                        if (playthroughCount > 0 || rated)
                          setConfirmation({ playthroughCount, rated });
                        else save(null, null);
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      Remove from journal
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {actions}
      </fieldset>
      <Dialog.Root
        open={confirmation !== null}
        onOpenChange={(open, event) => {
          if (busy.current) event.cancel();
          else if (!open) {
            setConfirmation(null);
            setError(undefined);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Popup
            initialFocus={cancel}
            finalFocus={trigger}
            className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto overscroll-contain rounded-xl border bg-background p-6 text-foreground shadow-lg"
          >
            <Dialog.Title className="font-heading text-lg font-medium">
              Remove {gameTitle} from journal?
            </Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-sm">
              {confirmation && removalDescription(gameTitle, confirmation)}
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
                loading={pending}
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
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {pending ? "Saving journal status…" : notice}
      </output>
      {error && confirmation === null && (
        <p role="alert" className="mt-2 max-w-xs text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function removalDescription(
  gameTitle: string,
  { playthroughCount, rated }: { playthroughCount: number; rated: boolean },
) {
  const playthroughs = playthroughCount > 0;
  const held = [
    playthroughs &&
      `${playthroughCount} ${playthroughCount === 1 ? "Playthrough" : "Playthroughs"}`,
    rated && "your Rating",
  ].filter(Boolean);
  const deleted = playthroughs
    ? rated
      ? "all current Playthroughs, private notes and your Rating"
      : "all current Playthroughs and private notes"
    : "your Rating";
  const community = rated
    ? `${playthroughs ? ", and the Rating" : " and"} will stop counting toward the Community rating`
    : "";
  return `${gameTitle} has ${held.join(" and ")}. If you remove it, ${deleted} will be permanently deleted${community}.`;
}
