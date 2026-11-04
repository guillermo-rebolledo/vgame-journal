"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeft, Check, ChevronRight, Search, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditorViewport } from "@/components/use-editor-viewport";
import {
  type Game,
  GameIdentity,
  GameLink,
  statuses,
  useSearchDemo,
  useSearchShortcut,
  type VariantProps,
} from "./shared";
import "./command.css";

export function CommandSearch(props: VariantProps & { picker?: ReactNode }) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const [selected, setSelected] = useState<Game | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const demo = useSearchDemo(props);
  useEditorViewport(open);
  useSearchShortcut(() => {
    setSelected(null);
    demo.setMessage("");
    setOpen(true);
    search.current?.focus({ preventScroll: true });
  });
  useEffect(() => {
    if (!open) return;
    if (selected) backButton.current?.focus({ preventScroll: true });
    else search.current?.focus({ preventScroll: true });
  }, [open, selected]);

  function changeOpen(next: boolean) {
    if (!next) {
      setSelected(null);
      demo.setMessage("");
    }
    setOpen(next);
  }
  const ready = demo.state === "ready" || demo.state === "empty";
  const count = demo.matches.length;
  const update =
    demo.state === "loading"
      ? "Searching the Catalog…"
      : demo.state === "error"
        ? ""
        : count === 0
          ? `No games found for “${demo.query}”. Try another title or clear search.`
          : `${count} ${count === 1 ? "game" : "games"} ${demo.query ? `found for “${demo.query}”` : "in the sample Catalog"}.`;
  function clearSearch() {
    demo.setQuery("");
    demo.setState("ready");
    search.current?.focus();
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      {!open && props.picker}
      <Dialog.Trigger
        render={
          <Button
            variant="outline"
            press="static"
            className="min-h-12 w-full justify-start gap-3"
          />
        }
      >
        <Search aria-hidden="true" />
        <span className="flex-1 text-start">Search games…</span>
        <span aria-hidden="true" className="text-xs">
          ⌘ / Ctrl K
        </span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-background/80" />
        <Dialog.Viewport className="command-viewport">
          <Dialog.Popup
            className="command-surface flex max-h-full w-[min(36rem,100%)] flex-col overflow-hidden rounded-xl border border-transparent bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none"
            initialFocus={() => search.current ?? false}
          >
            <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-2">
              <Dialog.Title className="font-medium text-sm">
                {selected ? "Game actions" : "Find a game"}
              </Dialog.Title>
              <Dialog.Close
                render={
                  <Button
                    variant="ghost"
                    className="size-11"
                    aria-label="Close search"
                  />
                }
              >
                <X aria-hidden="true" />
              </Dialog.Close>
            </header>
            <Dialog.Description className="sr-only">
              Search the Catalog, choose a game, then save its Status in your
              Journal.
            </Dialog.Description>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 [scrollbar-gutter:stable]">
              <Combobox.Root<Game>
                inline
                open
                autoHighlight
                items={ready ? demo.matches : []}
                filter={null}
                inputValue={demo.query}
                onInputValueChange={demo.setQuery}
                itemToStringLabel={(game) => game.title}
                onValueChange={(game, event) => {
                  event.cancel();
                  if (game) {
                    demo.setMessage("");
                    setSelected(game);
                  }
                }}
              >
                <div hidden={!!selected}>
                  <label
                    htmlFor={`${id}-query`}
                    className="mb-2 block font-medium text-sm"
                  >
                    Search games
                  </label>
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-s-3 top-3.5 size-4 text-muted-foreground"
                    />
                    <Combobox.Input
                      ref={search}
                      id={`${id}-query`}
                      aria-describedby={`${id}-help`}
                      placeholder="Try Hollow Knight or Celeste"
                      autoComplete="off"
                      spellCheck={false}
                      render={<Input />}
                      className="command-input min-h-11 ps-10 pe-12"
                    />
                    {demo.query && (
                      <Button
                        variant="ghost"
                        className="absolute inset-e-0 top-0 size-11"
                        aria-label="Clear search text"
                        onClick={clearSearch}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  <p
                    id={`${id}-help`}
                    className="mt-2 text-muted-foreground text-xs"
                  >
                    Choose a game to see its actions.
                  </p>
                  <p
                    aria-hidden="true"
                    className="py-3 text-muted-foreground text-xs tabular-nums"
                  >
                    {update}
                    {ready && count > 3 && " Scroll to browse all games."}
                  </p>
                  {demo.state === "error" && (
                    <div
                      role="alert"
                      className="flex flex-col items-start gap-3 py-4"
                    >
                      <p>
                        Search isn’t working right now. Your search is kept.
                      </p>
                      <Button
                        variant="outline"
                        className="min-h-11"
                        onClick={() => {
                          demo.setState("loading");
                          search.current?.focus();
                        }}
                      >
                        Try again
                      </Button>
                    </div>
                  )}
                  {ready && count === 0 && (
                    <div className="flex flex-col items-start gap-3 py-4">
                      <p>No games found for “{demo.query || "your search"}”.</p>
                      <p className="text-muted-foreground text-sm">
                        Check the spelling or try another title.
                      </p>
                      <Button
                        variant="outline"
                        className="min-h-11"
                        onClick={clearSearch}
                      >
                        Clear search
                      </Button>
                    </div>
                  )}
                  {/* Keep the controlled list relationship valid even when no options exist. */}
                  <Combobox.List
                    aria-label="Search results"
                    aria-busy={demo.state === "loading"}
                  >
                    {(game: Game) => (
                      <Combobox.Item
                        key={game.id}
                        value={game}
                        className="command-result flex min-h-16 cursor-default items-center gap-3 rounded-lg p-2 outline-none data-highlighted:bg-muted"
                      >
                        <GameIdentity game={game} />
                        <ChevronRight
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
                        />
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </div>
              </Combobox.Root>
              {selected && (
                <div className="flex flex-col gap-6">
                  <Button
                    ref={backButton}
                    variant="ghost"
                    press="static"
                    className="min-h-11 self-start"
                    onClick={() => {
                      demo.setMessage("");
                      setSelected(null);
                    }}
                  >
                    <ArrowLeft aria-hidden="true" className="rtl:rotate-180" />
                    Back to results
                  </Button>
                  <div className="flex items-center gap-3">
                    <GameIdentity game={selected} />
                  </div>
                  <section
                    aria-labelledby={`${id}-status`}
                    className="flex flex-col gap-3"
                  >
                    <h3 id={`${id}-status`} className="font-medium text-sm">
                      Journal status
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {demo.saved[selected.id]
                        ? `Current status: ${demo.saved[selected.id]}`
                        : "Not in your Journal"}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {statuses.map((status) => (
                        <Button
                          key={status}
                          variant="outline"
                          press="static"
                          className="min-h-11 justify-start transition-none"
                          aria-label={`Save to ${status} for ${selected.title}`}
                          onClick={() => demo.save(selected, status)}
                        >
                          {demo.saved[selected.id] === status && (
                            <Check aria-hidden="true" />
                          )}
                          Save to {status}
                        </Button>
                      ))}
                    </div>
                  </section>
                  <GameLink game={selected} />
                  {demo.message && <p className="text-sm">{demo.message}</p>}
                </div>
              )}
            </div>
            <p className="shrink-0 px-4 py-3 text-muted-foreground text-xs">
              {selected
                ? "Back to results to find another game · Escape to close"
                : "↑ ↓ to browse · Enter for actions · Escape to close"}
            </p>
            <output
              aria-label="Search updates"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {selected ? demo.message : update}
            </output>
            {props.picker}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
