"use client";

import { BookMarked, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";
import { trackEvent } from "@/components/analytics";
import {
  type JournalSelection,
  JournalStatus,
  type SaveJournalStatus,
} from "@/components/journal-status";
import {
  PlaythroughForm,
  type SavePlaythrough,
} from "@/components/playthrough-form";
import { PlaythroughHistory } from "@/components/playthrough-history";
import { ActionIcon } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { toast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorViewport } from "@/components/use-editor-viewport";
import type { playthrough } from "@/db/schema";
import { authPageHref } from "@/lib/auth-continuation";
import type { Status } from "@/lib/library";

type Playthrough = typeof playthrough.$inferSelect;
export function GameRecording({
  signedIn,
  entry,
  playthroughs,
  gameTitle,
  platforms,
  onStatus,
  onAdd,
  onUpdate,
  onRemove,
  listPicker,
}: {
  signedIn: boolean;
  listPicker?: ReactNode;
  entry: JournalSelection;
  playthroughs: Playthrough[];
  gameTitle: string;
  platforms: string[];
  onStatus: SaveJournalStatus;
  onAdd: SavePlaythrough;
  onUpdate: (
    id: number,
    values: Record<string, string>,
  ) => ReturnType<SavePlaythrough>;
  onRemove: (id: number) => ReturnType<SavePlaythrough>;
}) {
  const signInHref = authPageHref("/sign-in", usePathname());
  const [editor, setEditor] = useState<Playthrough | "add" | null>(null);
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string>();
  const drafts = useRef(new Map<string | number, Record<string, string>>());
  const addTrigger = useRef<HTMLButtonElement | null>(null);
  const drawer = useRef<HTMLDivElement | null>(null);
  const initiator = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  const completion = useRef<string | null>(null);
  const key = editor === "add" ? "add" : editor?.id;
  useEditorViewport(editor !== null);
  function open(value: Playthrough | "add") {
    initiator.current = document.activeElement as HTMLElement;
    setError(undefined);
    setEditor(value);
  }
  function close(discard = false) {
    if (busy.current) return;
    if (discard && key !== undefined) drafts.current.delete(key);
    setEditor(null);
  }
  async function remove() {
    if (!editor || editor === "add" || busy.current) return;
    busy.current = true;
    setPending(true);
    setRemoving(true);
    setError(undefined);
    try {
      const result = await onRemove(editor.id);
      if (result) setError(result.error);
      else {
        drafts.current.delete(editor.id);
        // The deleted row's Edit button can outlive dismissal until history refreshes.
        initiator.current = addTrigger.current;
        completion.current = "Playthrough deleted";
        setEditor(null);
        trackEvent("playthrough_removed");
      }
    } catch {
      setError("Couldn’t delete. Check your connection and try again.");
    } finally {
      busy.current = false;
      setPending(false);
      setRemoving(false);
    }
  }
  const additionalActions = (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              ref={addTrigger}
              aria-label="Add playthrough"
              variant="outline"
              disabled={pending}
              className="journal-action min-h-11"
              render={signedIn ? undefined : <Link href={signInHref} />}
              onClick={signedIn ? () => open("add") : undefined}
            />
          }
        >
          <Plus />
          Add playthrough
        </TooltipTrigger>
        <TooltipContent>Add playthrough</TooltipContent>
      </Tooltip>
      {listPicker}
    </>
  );
  return (
    <TooltipProvider delay={300}>
      <section aria-label="Game journal" className="flex flex-col gap-4">
        {signedIn ? (
          <JournalStatus
            actions={additionalActions}
            entry={entry}
            gameTitle={gameTitle}
            playthroughCount={playthroughs.length}
            disabled={pending}
            onSave={async (status, tag, acknowledged) => {
              busy.current = true;
              setPending(true);
              try {
                return await onStatus(status, tag, acknowledged);
              } finally {
                busy.current = false;
                setPending(false);
              }
            }}
          />
        ) : (
          <fieldset
            aria-label="Game actions"
            className="flex min-w-0 flex-wrap items-start gap-3"
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    render={<Link href={signInHref} />}
                    aria-label={`Add to Journal for ${gameTitle}`}
                    variant="outline"
                    className="journal-action min-h-11"
                  />
                }
              >
                <BookMarked />
                Add to Journal
              </TooltipTrigger>
              <TooltipContent>Journal status</TooltipContent>
            </Tooltip>
            {additionalActions}
          </fieldset>
        )}
        {!signedIn ? (
          <p className="text-muted-foreground text-sm">
            <Link href={signInHref} className="underline underline-offset-4">
              Sign in
            </Link>{" "}
            to record games and playthroughs.
          </p>
        ) : null}
        {signedIn && (
          <PlaythroughHistory playthroughs={playthroughs} onEdit={open} />
        )}
      </section>

      <Drawer
        showSwipeHandle
        open={editor !== null}
        onOpenChangeComplete={(open) => {
          if (!open && completion.current) {
            toast.add({
              title: completion.current,
              description: gameTitle,
              type: "success",
            });
            completion.current = null;
          }
        }}
        onOpenChange={(value, event) => {
          if (!value && busy.current) {
            event.cancel();
            return;
          }
          if (!value) close();
        }}
      >
        <DrawerContent
          ref={drawer}
          finalFocus={() =>
            initiator.current?.isConnected
              ? initiator.current
              : addTrigger.current
          }
          className="editor-drawer w-full overflow-hidden rounded-t-3xl bg-background"
        >
          <DrawerHeader className="shrink-0 border-b px-[min(1.5rem,5vw)] py-5">
            <div className="mx-auto flex w-full max-w-xl items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-1 text-left [overflow-wrap:anywhere]">
                <DrawerDescription className="line-clamp-2">
                  {gameTitle}
                </DrawerDescription>
                <DrawerTitle>
                  {editor === "add" ? "Add playthrough" : "Edit playthrough"}
                </DrawerTitle>
              </div>
              <Button
                aria-label="Close"
                variant="ghost"
                className="size-11 rounded-full"
                onClick={() => close()}
                disabled={pending}
              >
                <X />
              </Button>
            </div>
          </DrawerHeader>
          {editor !== null && key !== undefined && (
            <PlaythroughForm
              key={key}
              disabled={pending}
              platforms={platforms}
              initial={
                drafts.current.get(key) ??
                (editor === "add"
                  ? {}
                  : {
                      platform: editor.platform,
                      startedOn: editor.startedOn,
                      endedOn: editor.endedOn ?? "",
                      hours: editor.hours === null ? "" : String(editor.hours),
                      notes: editor.notes,
                    })
              }
              outsideJournal={!entry}
              onSave={
                editor === "add"
                  ? onAdd
                  : (values) => onUpdate(editor.id, values)
              }
              onSuccess={(values) => {
                drafts.current.delete(key);
                completion.current =
                  editor === "add"
                    ? "Playthrough saved"
                    : "Playthrough updated";
                setEditor(null);
                if (editor !== "add") return;
                // Saving a playthrough outside the journal adds the game too.
                if (!entry)
                  trackEvent("journal_status_set", {
                    status: (values.status ?? "playing") as Status,
                    change: "added",
                  });
                trackEvent("playthrough_added", {
                  has_notes: Boolean(values.notes?.trim()),
                  has_hours: Boolean(values.hours),
                });
              }}
              onCancel={() => close(true)}
              onDraft={(values) => {
                drafts.current.set(key, values);
              }}
              onPending={(value) => {
                busy.current = value;
                setPending(value);
              }}
            />
          )}
          {editor !== null && editor !== "add" && (
            <div className="shrink-0 border-t px-6 py-2 pb-[max(.5rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto max-w-xl">
                <Button
                  variant="destructive"
                  disabled={pending}
                  className="min-h-11"
                  onClick={remove}
                  aria-busy={removing}
                >
                  <ActionIcon
                    icon={<Trash2 />}
                    state={removing ? "pending" : "idle"}
                  />
                  <span className={removing ? "shimmer" : undefined}>
                    Delete playthrough
                  </span>
                </Button>
                <output className="block text-muted-foreground text-sm empty:hidden">
                  {removing ? "Deleting playthrough…" : ""}
                </output>
                {error && (
                  <p role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                )}
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </TooltipProvider>
  );
}
