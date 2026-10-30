"use client";

import { BookMarked, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { playthrough } from "@/db/schema";
import { authPageHref } from "@/lib/auth-continuation";

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
  const [error, setError] = useState<string>();
  const drafts = useRef(new Map<string | number, Record<string, string>>());
  const addTrigger = useRef<HTMLButtonElement | null>(null);
  const drawer = useRef<HTMLDivElement | null>(null);
  const initiator = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  const key = editor === "add" ? "add" : editor?.id;
  useEffect(() => {
    if (!editor || !window.visualViewport) return;
    const viewport = window.visualViewport;
    function resize() {
      const desktop = window.matchMedia("(min-width: 48rem)").matches;
      const navbarHeight =
        document.querySelector("body > header")?.getBoundingClientRect()
          .height ?? 56;
      const availableHeight =
        viewport.height - navbarHeight - 16 - (desktop ? 24 : 0);
      // A tall navigation header may sit behind the modal; never let it consume the editor.
      const editorHeight = Math.max(
        0,
        Math.min(
          Math.max(availableHeight, viewport.height * 0.6),
          viewport.height - 16,
          desktop ? 720 : 960,
        ),
      );
      // On the document, not on `drawer`: the popup mounts in a portal, and its ref is still
      // null on the first run, which used to leave the drawer on its CSS fallback height.
      const root = document.documentElement.style;
      root.setProperty("--editor-height", `${editorHeight}px`);
      root.setProperty(
        "--editor-bottom",
        `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`,
      );
    }
    const header = document.querySelector("body > header");
    const observer = new ResizeObserver(resize);
    if (header) observer.observe(header);
    resize();
    viewport.addEventListener("resize", resize);
    viewport.addEventListener("scroll", resize);
    return () => {
      observer.disconnect();
      viewport.removeEventListener("resize", resize);
      viewport.removeEventListener("scroll", resize);
      document.documentElement.style.removeProperty("--editor-height");
      document.documentElement.style.removeProperty("--editor-bottom");
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
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    render={<Link href={signInHref} />}
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
                  render={signedIn ? undefined : <Link href={signInHref} />}
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
            <Link href={signInHref} className="underline underline-offset-4">
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

      <Drawer
        showSwipeHandle
        open={editor !== null}
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
          className="playthrough-drawer w-full overflow-hidden rounded-t-3xl bg-background"
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
        </DrawerContent>
      </Drawer>
    </TooltipProvider>
  );
}
