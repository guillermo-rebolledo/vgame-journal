"use client";

import { BookMarked, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  type JournalSelection,
  JournalStatus,
} from "@/components/journal-status";
import {
  PlaythroughForm,
  type SavePlaythrough,
} from "@/components/playthrough-form";
import { PlaythroughHistory } from "@/components/playthrough-history";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { playthrough } from "@/db/schema";
import type { CompletionTag, Status } from "@/lib/library";

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
}: {
  signedIn: boolean;
  entry: JournalSelection;
  playthroughs: Playthrough[];
  gameTitle: string;
  platforms: string[];
  onStatus: (
    status: Status | null,
    tag: CompletionTag | null,
  ) => ReturnType<SavePlaythrough>;
  onAdd: SavePlaythrough;
  onUpdate: (
    id: number,
    values: Record<string, string>,
  ) => ReturnType<SavePlaythrough>;
  onRemove: (id: number) => ReturnType<SavePlaythrough>;
}) {
  const [editor, setEditor] = useState<Playthrough | "add" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const drafts = useRef(new Map<string | number, Record<string, string>>());
  const addTrigger = useRef<HTMLButtonElement | null>(null);
  const sheet = useRef<HTMLDivElement | null>(null);
  const initiator = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  const key = editor === "add" ? "add" : editor?.id;
  useEffect(() => {
    if (!editor || !window.visualViewport) return;
    const viewport = window.visualViewport;
    function resize() {
      sheet.current?.style.setProperty(
        "--editor-height",
        `${Math.min(viewport.height * 0.94, 960)}px`,
      );
      sheet.current?.style.setProperty(
        "--editor-bottom",
        `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`,
      );
    }
    resize();
    viewport.addEventListener("resize", resize);
    viewport.addEventListener("scroll", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      viewport.removeEventListener("scroll", resize);
    };
  }, [editor]);
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
    setError(undefined);
    try {
      const result = await onRemove(editor.id);
      if (result) setError(result.error);
      else {
        drafts.current.delete(editor.id);
        setEditor(null);
      }
    } catch {
      setError("Couldn’t delete. Check your connection and try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <TooltipProvider delay={300}>
      <section
        aria-label="Game journal"
        className="flex min-h-24 flex-col gap-4"
      >
        <div className="flex items-start gap-3">
          {signedIn ? (
            <JournalStatus
              entry={entry}
              disabled={pending}
              onSave={async (status, tag) => {
                busy.current = true;
                setPending(true);
                try {
                  return await onStatus(status, tag);
                } finally {
                  busy.current = false;
                  setPending(false);
                }
              }}
            />
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    render={<Link href="/sign-in" />}
                    aria-label="Journal status"
                    variant="outline"
                    className="size-11 rounded-full"
                  />
                }
              >
                <BookMarked />
              </TooltipTrigger>
              <TooltipContent>Journal status</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  ref={addTrigger}
                  aria-label="Add playthrough"
                  variant="outline"
                  disabled={pending}
                  className="size-11 rounded-full"
                  render={signedIn ? undefined : <Link href="/sign-in" />}
                  onClick={signedIn ? () => open("add") : undefined}
                />
              }
            >
              <Plus />
            </TooltipTrigger>
            <TooltipContent>Add playthrough</TooltipContent>
          </Tooltip>
        </div>
        {!signedIn ? (
          <p className="text-muted-foreground text-sm">
            <Link href="/sign-in" className="underline underline-offset-4">
              Sign in
            </Link>{" "}
            to record games and playthroughs.
          </p>
        ) : !playthroughs.length ? (
          <p className="text-muted-foreground text-sm">No playthroughs yet.</p>
        ) : null}
      </section>
      {signedIn && playthroughs.length > 0 && (
        <section
          aria-label="Playthroughs"
          className="order-1 flex flex-col gap-1"
        >
          <h2 className="font-medium">Playthroughs</h2>
          <PlaythroughHistory playthroughs={playthroughs} onEdit={open} />
        </section>
      )}

      <Sheet
        open={editor !== null}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          ref={sheet}
          finalFocus={() =>
            initiator.current?.isConnected
              ? initiator.current
              : addTrigger.current
          }
          className="playthrough-sheet mx-auto h-[94dvh] max-h-[960px] max-w-3xl gap-0 overflow-hidden rounded-t-3xl bg-background"
        >
          <SheetHeader className="shrink-0 border-b px-6 py-5">
            <div className="mx-auto flex w-full max-w-xl items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <SheetDescription>{gameTitle}</SheetDescription>
                <SheetTitle>
                  {editor === "add" ? "Add playthrough" : "Edit playthrough"}
                </SheetTitle>
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
          </SheetHeader>
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
              onSuccess={() => {
                drafts.current.delete(key);
                setEditor(null);
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
                >
                  Delete playthrough
                </Button>
                {error && (
                  <p role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
