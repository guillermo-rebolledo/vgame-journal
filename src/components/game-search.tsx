"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  positionBucket,
  resultsBucket,
  trackEvent,
} from "@/components/analytics";
import { CatalogSearch } from "@/components/catalog-search";
import { GameCover } from "@/components/game-cover";
import { GameIdentificationMetadata } from "@/components/game-identification-metadata";
import { HomeCoverLink } from "@/components/home-cover-link";
import { HomeSaveControls } from "@/components/home-journal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useEditorViewport } from "@/components/use-editor-viewport";
import "./game-search.css";
import type { SearchResult } from "@/lib/catalog";
import { takeCatalogSearchInitiator } from "@/lib/catalog-search-navigation";
import { cn } from "@/lib/utils";

const MIN_QUERY = 2;

/** What came back for one query and attempt; null results mean the search failed. */
type Answer = { q: string; attempt: number; results: SearchResult[] | null };

export function GameSearch({
  guidance,
  renderAction,
  renderFeedback,
  inputRef,
  presentation = "catalog",
  continuation,
}: {
  continuation?: ReactNode;
  guidance?: string;
  renderAction?: (game: SearchResult) => ReactNode;
  renderFeedback?: (game: SearchResult | null) => ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  presentation?: "catalog" | "embedded";
}) {
  const id = useId();
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").slice(0, 100);
  const year = searchParams.get("year") ?? "";
  const platform = searchParams.get("platform") ?? "";
  const filtersOpen = searchParams.get("filters") === "1";
  const activeFilters = Number(Boolean(year)) + Number(Boolean(platform));
  const [open, setOpen] = useState(false);
  const pendingBody = useRef<HTMLDivElement>(null);
  const hasContinuation = !!continuation;
  useEffect(() => {
    if (hasContinuation && isVisible(owner.current)) {
      setSelected(null);
      setOpen(true);
    }
  }, [hasContinuation]);
  const input = useRef<HTMLInputElement>(null);
  const owner = useRef<HTMLDivElement>(null);
  const restoredContext = useRef<string | null>(null);
  const initiator = useRef<HTMLElement | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  const scroll = useRef(0);
  const [selected, setSelected] = useState<{
    game: SearchResult;
    position: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (presentation === "catalog" && !open) return;
    if (hasContinuation)
      pendingBody.current
        ?.querySelector<HTMLElement>("a, button")
        ?.focus({ preventScroll: presentation === "embedded" });
    else if (selected)
      back.current?.focus({ preventScroll: presentation === "embedded" });
    else if (presentation === "catalog") {
      // Let route focus restoration finish before focusing the inline search.
      const frame = requestAnimationFrame(() => {
        input.current?.focus({ preventScroll: true });
        if (window.innerWidth <= 640)
          input.current?.scrollIntoView({
            block: "center",
            behavior: "instant",
          });
      });
      return () => cancelAnimationFrame(frame);
    } else {
      input.current?.focus({ preventScroll: true });
      if (body.current) body.current.scrollTop = scroll.current;
    }
  }, [open, presentation, selected, hasContinuation]);
  useEditorViewport(presentation === "catalog" && open && hasContinuation);
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const q = query.trim();

  const context = JSON.stringify([
    query,
    year,
    platform,
    filtersOpen,
    searchParams.get("search"),
  ]);
  const pendingIntent = searchParams.has("saveGame");
  useEffect(() => {
    function restore() {
      const params = new URLSearchParams(window.location.search);
      if (
        presentation !== "catalog" ||
        pendingIntent ||
        params.has("saveGame") ||
        !isVisible(owner.current)
      )
        return;
      if (
        (params.get("q") ?? "").trim().length >= MIN_QUERY ||
        params.get("search") === "1"
      ) {
        if (params.get("search") === "1") {
          const control = takeCatalogSearchInitiator();
          if (control) initiator.current = control;
        }
        setSelected(null);
        setOpen(true);
      }
    }
    if (restoredContext.current !== context) restore();
    restoredContext.current = context;
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      // React's retained Home view resumes effects when navigation makes it visible again.
      restoredContext.current = null;
    };
  }, [context, pendingIntent, presentation]);

  useEffect(() => {
    function activate() {
      if (presentation !== "catalog" || !isVisible(owner.current)) return;
      initiator.current =
        takeCatalogSearchInitiator() ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      setSelected(null);
      setOpen(true);
      input.current?.focus({ preventScroll: false });
    }
    window.addEventListener("catalog-search-open", activate);
    return () => window.removeEventListener("catalog-search-open", activate);
  }, [presentation]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "k" ||
        (!isVisible(owner.current) && !isVisible(body.current))
      )
        return;
      const modal = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="dialog"], [role="alertdialog"]',
        ),
      )
        .filter(isVisible)
        .at(-1);
      // Only the search in the active editor may claim its shortcut.
      if (
        modal &&
        !modal.contains(input.current) &&
        !modal.contains(body.current)
      )
        return;
      event.preventDefault();
      setSelected(null);
      if (presentation === "catalog") {
        if (!open)
          initiator.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        setOpen(true);
      }
      requestAnimationFrame(() =>
        input.current?.focus({ preventScroll: presentation === "embedded" }),
      );
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [presentation, open]);

  function updateSearch(values: Record<string, string>) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  useEffect(() => {
    // Embedded content mounts with its active host, before drawer visibility settles.
    if (
      hasContinuation ||
      q.length < MIN_QUERY ||
      (presentation === "catalog" &&
        (!open || (!isVisible(owner.current) && !isVisible(body.current))))
    )
      return;
    if (answer?.q === q && answer.attempt === attempt) return;
    const controller = new AbortController();
    const debounce = setTimeout(async () => {
      let results: SearchResult[] | null = null;
      try {
        const res = await fetch(
          `/api/games/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(res.statusText);
        results = await res.json();
      } catch {}
      // A newer query or retry took over; its answer wins even if this one lands later.
      if (!controller.signal.aborted) setAnswer({ q, attempt, results });
    }, 300);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [q, attempt, open, presentation, answer, hasContinuation]);

  // Only the answer to exactly this query and attempt counts; anything else is still loading.
  const idle = q.length < MIN_QUERY;
  const current =
    !idle && answer?.q === q && answer.attempt === attempt ? answer : null;
  const results = current?.results;
  const failed = current && !results;
  const years = [
    ...new Set(
      results?.flatMap((game) => (game.year ? [game.year] : [])) ?? [],
    ),
  ].sort((a, b) => b - a);
  const platforms = [
    ...new Set(results?.flatMap((game) => game.platforms) ?? []),
  ]
    .filter(
      (name) =>
        name === platform ||
        results?.some((game) => !game.platforms.includes(name)),
    )
    .sort();
  const showYear =
    Boolean(year) ||
    (years.length > 0 &&
      (years.length > 1 ||
        Boolean(results?.some((game) => game.year === null))));
  const showPlatform =
    Boolean(platform) ||
    platforms.some((name) =>
      results?.some((game) => !game.platforms.includes(name)),
    );
  const matches = results?.filter(
    (game) =>
      (!year || String(game.year) === year) &&
      (!platform || game.platforms.includes(platform)),
  );

  const matched = matches?.length;
  useLayoutEffect(() => {
    const element = list.current;
    if (
      !element ||
      selected ||
      !matched ||
      !current ||
      (presentation === "catalog" && !open) ||
      typeof ResizeObserver === "undefined"
    ) {
      setScrollable(false);
      return;
    }
    const measure = () =>
      setScrollable(element.scrollHeight > element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [matched, current, open, selected, presentation]);

  // Once per settled answer or filter change; the query itself never leaves the browser.
  useEffect(() => {
    if (!current?.results || matched === undefined) return;
    trackEvent("game_searched", {
      results: resultsBucket(matched),
      filtered: Boolean(year || platform),
    });
  }, [current, matched, year, platform]);

  function changeOpen(next: boolean) {
    if (next && !open)
      initiator.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    setSelected(null);
    setOpen(next);
  }

  const updates = (
    <>
      <output
        aria-label="Search updates"
        aria-live="polite"
        aria-atomic="true"
        className="text-muted-foreground text-sm empty:hidden"
      >
        {q.length < MIN_QUERY ? (
          "Enter at least 2 characters to search the Catalog."
        ) : idle || failed ? (
          ""
        ) : !current ? (
          <>
            <Spinner className="mr-2" />
            <span className="shimmer">Searching…</span>
          </>
        ) : (year || platform) && matches?.length === 0 ? (
          "No matches in these results. Clear filters or search for a more specific title."
        ) : results?.length === 0 ? (
          `No matches returned for “${q}”. Check the spelling or try different words from the title.`
        ) : year || platform ? (
          `${matches?.length} of ${results?.length} returned matches ${matches?.length === 1 ? "fits" : "fit"} your filters.`
        ) : (
          `${results?.length} returned ${results?.length === 1 ? "match" : "matches"} for “${q}”.`
        )}
      </output>
      {failed && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
        >
          <p>Search isn’t working right now. Your search is kept.</p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setAttempt(attempt + 1);
              input.current?.focus({
                preventScroll: presentation === "embedded",
              });
            }}
          >
            Try again
          </Button>
        </div>
      )}
    </>
  );

  const content = (
    <div
      ref={body}
      className="game-search-content min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable]"
    >
      {guidance && (
        <p id={`${id}-guidance`} className="text-muted-foreground text-sm">
          {guidance}
        </p>
      )}
      <Combobox.Root<SearchResult>
        inline
        open
        items={matches ?? []}
        filter={null}
        inputValue={query}
        itemToStringLabel={(game) => game.title}
        onValueChange={(game, event) => {
          event.cancel();
          if (!game) return;
          scroll.current = body.current?.scrollTop ?? 0;
          setSelected({
            game,
            position:
              (matches?.findIndex((item) => item.id === game.id) ?? 0) + 1,
          });
        }}
        onInputValueChange={(value) =>
          updateSearch({
            q: value.slice(0, 100),
            all: "",
            year: "",
            platform: "",
            filters: value && filtersOpen ? "1" : "",
          })
        }
      >
        <search
          hidden={!!selected}
          aria-labelledby={`${id}-label`}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-2">
            <label
              id={`${id}-label`}
              htmlFor={`${id}-input`}
              className="font-medium"
            >
              Search games
            </label>
            <Combobox.Input
              ref={(element) => {
                input.current = element;
                if (typeof inputRef === "function") inputRef(element);
                else if (inputRef) inputRef.current = element;
              }}
              render={<Input />}
              type="search"
              id={`${id}-input`}
              aria-describedby={guidance ? `${id}-guidance` : `${id}-help`}
              placeholder="Search games…"
              maxLength={100}
              className="game-search-input h-11 transition-none"
            />
            {!guidance && (
              <p id={`${id}-help`} className="text-muted-foreground text-xs">
                Choose a game to see its actions. Use arrow keys to browse and
                Enter to choose.
              </p>
            )}
          </div>
          {updates}
          {(showYear || showPlatform) && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="min-h-11"
                  aria-expanded={filtersOpen}
                  aria-controls={`${id}-filters`}
                  onClick={() =>
                    updateSearch({ filters: filtersOpen ? "" : "1" })
                  }
                >
                  Filters{activeFilters > 0 ? ` (${activeFilters} active)` : ""}
                  <ChevronDown aria-hidden="true" />
                </Button>
                {activeFilters > 0 && (
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    onClick={() => {
                      updateSearch({ year: "", platform: "", all: "" });
                      input.current?.focus({
                        preventScroll: presentation === "embedded",
                      });
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
              <div
                id={`${id}-filters`}
                className={cn(
                  "grid-cols-1 items-end gap-3 sm:grid-cols-2",
                  filtersOpen ? "grid" : "hidden",
                )}
              >
                {showYear && (
                  <SearchFilter
                    id={`${id}-year`}
                    descriptionId={`${id}-filter-help`}
                    label="Release year"
                    value={year}
                    emptyLabel="All years"
                    options={years.map(String)}
                    onChange={(year) => updateSearch({ year, all: "" })}
                  />
                )}
                {showPlatform && (
                  <SearchFilter
                    id={`${id}-platform`}
                    descriptionId={`${id}-filter-help`}
                    label="Platform"
                    value={platform}
                    emptyLabel="All platforms"
                    options={platforms}
                    onChange={(platform) => updateSearch({ platform, all: "" })}
                  />
                )}
              </div>
            </div>
          )}
          {(results || year || platform) && (
            <p
              id={`${id}-filter-help`}
              className="text-muted-foreground text-xs"
            >
              Search returns up to 50 candidates. Filters narrow these returned
              results only. Use a more specific title to find other games.
            </p>
          )}
          {scrollable && (
            <p aria-hidden="true" className="text-muted-foreground text-xs">
              Scroll to browse all returned matches.
            </p>
          )}
          <Combobox.List
            ref={list}
            aria-label="Search results"
            aria-busy={!idle && !current}
            className="max-h-72 overflow-y-auto overscroll-contain"
          >
            {(game: SearchResult) => (
              <Combobox.Item
                key={game.id}
                value={game}
                className="game-search-result flex min-h-20 cursor-default items-center gap-3 rounded-lg p-2 outline-none data-highlighted:bg-muted"
              >
                <GameCover
                  imageId={game.coverImageId}
                  size="cover_small"
                  className="w-12 rounded"
                />
                <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <p className="font-medium">
                    <bdi>{game.title}</bdi>
                  </p>
                  <div className="text-muted-foreground text-xs">
                    <p className="tabular-nums">
                      {game.year ?? "Year unavailable"}
                    </p>
                    <p>
                      {game.platforms.join(", ") ||
                        "Platform availability unknown"}
                    </p>
                  </div>
                </div>
              </Combobox.Item>
            )}
          </Combobox.List>
        </search>
      </Combobox.Root>
      {selected && (
        <div className="flex flex-col gap-4">
          <Button
            ref={back}
            variant="ghost"
            press="static"
            className="min-h-11 self-start"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft aria-hidden="true" />
            Back to results
          </Button>
          <div className="flex items-start gap-3">
            <GameCover
              imageId={selected.game.coverImageId}
              className="w-16 rounded"
            />
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <h3 className="font-medium">
                <bdi>{selected.game.title}</bdi>
              </h3>
              <GameIdentificationMetadata
                title={selected.game.title}
                year={selected.game.year}
                platforms={selected.game.platforms}
                selectedPlatform={platform}
              />
            </div>
          </div>
          <div key={selected.game.id}>
            {renderAction ? (
              renderAction(selected.game)
            ) : (
              <HomeSaveControls
                game={{ ...selected.game, gameId: selected.game.id }}
              />
            )}
          </div>
          <HomeCoverLink
            gameId={selected.game.id}
            source="search"
            cover={null}
            href={`/games/${selected.game.slug}`}
            aria-label={`View game: ${selected.game.title}`}
            event={[
              "search_result_opened",
              { position: positionBucket(selected.position) },
            ]}
            onClick={(event) => {
              if (
                event.button === 0 &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              )
                changeOpen(false);
            }}
            onAuxClick={(event) => {
              if (event.button === 1)
                trackEvent("search_result_opened", {
                  position: positionBucket(selected.position),
                });
            }}
            className="flex min-h-11 items-center self-start rounded-lg px-2 underline underline-offset-4"
          >
            View game<span className="sr-only">: {selected.game.title}</span>
          </HomeCoverLink>
        </div>
      )}
    </div>
  );
  if (presentation === "catalog" && !hasContinuation)
    return (
      <div ref={owner}>
        <CatalogSearch
          finalFocus={() =>
            initiator.current?.isConnected &&
            !initiator.current.closest("[hidden]") &&
            (initiator.current.checkVisibility?.() ?? true) &&
            initiator.current !== document.body
              ? initiator.current
              : (input.current ?? false)
          }
          query={query}
          year={year}
          platform={platform}
          years={years}
          platforms={platforms}
          matches={matches ?? []}
          open={open}
          onOpenChange={changeOpen}
          onChange={updateSearch}
          inputRef={(element) => {
            input.current = element;
            if (typeof inputRef === "function") inputRef(element);
            else if (inputRef) inputRef.current = element;
          }}
          bodyRef={body}
          listRef={list}
          updates={updates}
          feedback={renderFeedback?.(null)}
          guidance={guidance}
          busy={!idle && !current}
          scrollable={scrollable}
        />
      </div>
    );
  if (presentation === "embedded")
    return (
      <div ref={owner} className="game-search flex min-h-0 flex-1 flex-col">
        {content}
      </div>
    );
  return (
    <div ref={owner}>
      <Dialog.Root open={open} onOpenChange={changeOpen}>
        <Dialog.Trigger
          render={
            <Button
              data-catalog-trigger
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
          <Dialog.Viewport className="game-search-viewport">
            <Dialog.Popup
              className="game-search game-search-surface flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-transparent bg-popover text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none"
              initialFocus={() =>
                hasContinuation
                  ? (pendingBody.current?.querySelector<HTMLElement>(
                      "a, button",
                    ) ?? false)
                  : (input.current ?? false)
              }
              finalFocus={() =>
                // Base UI resolves the target before removing background inertness.
                initiator.current?.isConnected &&
                !initiator.current.closest("[hidden]") &&
                (initiator.current.checkVisibility?.() ?? true) &&
                initiator.current !== document.body
                  ? initiator.current
                  : (owner.current?.querySelector("button") ?? false)
              }
            >
              <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-2">
                <Dialog.Title className="font-medium">
                  {hasContinuation
                    ? "Continue Journal save"
                    : selected
                      ? "Game actions"
                      : "Find a game"}
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
                Search the Catalog and choose a game to see its actions.
              </Dialog.Description>
              {renderFeedback?.(selected?.game ?? null)}
              {hasContinuation ? (
                <div
                  ref={pendingBody}
                  className="min-h-0 overflow-y-auto overscroll-contain p-4"
                >
                  {continuation}
                </div>
              ) : (
                content
              )}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function SearchFilter({
  id,
  descriptionId,
  label,
  value,
  emptyLabel,
  options,
  onChange,
}: {
  id: string;
  descriptionId: string;
  label: string;
  value: string;
  emptyLabel: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const unavailable = value && !options.includes(value);
  const selectedLabel = value
    ? `${value}${unavailable ? " (not in these results)" : ""}`
    : emptyLabel;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-sm">
      <label htmlFor={id}>{label}</label>
      <div className="game-search-filter relative rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <div
          aria-hidden="true"
          className="pointer-events-none flex min-h-11 items-center gap-2 px-2 py-2 text-base"
        >
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            {selectedLabel}
          </span>
          <ChevronDown className="size-4 shrink-0" />
        </div>
        {/* Keep the native picker while allowing its visible value to wrap. */}
        <select
          id={id}
          value={value}
          aria-describedby={descriptionId}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          <option value="">{emptyLabel}</option>
          {unavailable && <option value={value}>{selectedLabel}</option>}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function isVisible(element: HTMLElement | null): element is HTMLElement {
  return (
    !!element &&
    !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
    (element.checkVisibility?.() ?? true)
  );
}
