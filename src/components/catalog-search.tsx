"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDown, Search, X } from "lucide-react";
import { type ReactNode, type Ref, useId, useRef } from "react";
import { positionBucket, trackEvent } from "@/components/analytics";
import { GameCover } from "@/components/game-cover";
import { HomeCoverLink } from "@/components/home-cover-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SearchResult } from "@/lib/catalog";

/** The standalone Catalog presentation; GameSearch owns requests and URL state. */
export function CatalogSearch({
  query,
  year,
  platform,
  years,
  platforms,
  matches,
  open,
  onOpenChange,
  onChange,
  inputRef,
  bodyRef,
  listRef,
  updates,
  feedback,
  guidance,
  busy,
  scrollable,
  finalFocus,
}: {
  query: string;
  year: string;
  platform: string;
  years: number[];
  platforms: string[];
  matches: SearchResult[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (values: Record<string, string>) => void;
  inputRef: Ref<HTMLInputElement>;
  bodyRef: Ref<HTMLDivElement>;
  listRef: Ref<HTMLDivElement>;
  updates: ReactNode;
  feedback: ReactNode;
  guidance?: string;
  busy: boolean;
  scrollable: boolean;
  finalFocus: () => HTMLElement | false;
}) {
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(true);
  return (
    <section
      className="game-search game-catalog rounded-xl border border-border bg-muted p-4 sm:p-6"
      aria-label="Find a game"
    >
      <h2 className="font-semibold text-2xl tracking-tight sm:text-3xl">
        Find your next game.
      </h2>
      <p id={`${id}-help`} className="mt-2 text-muted-foreground text-sm">
        {guidance || "Search the Catalog. Find a game for your shelf."}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Popover.Root
          open={open}
          onOpenChange={(next, details) => {
            restoreFocus.current =
              details.reason !== "outside-press" &&
              details.reason !== "focus-out";
            onOpenChange(next);
          }}
          modal={false}
        >
          <div
            ref={anchor}
            className="game-catalog-input flex h-11 min-w-0 flex-[1_1_17.5rem] items-center gap-2 rounded-lg border border-input bg-background px-3"
          >
            <Search
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={(element) => {
                input.current = element;
                if (typeof inputRef === "function") inputRef(element);
                else if (inputRef) inputRef.current = element;
              }}
              type="search"
              role="combobox"
              aria-label="Search games"
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-controls={open ? `${id}-results` : undefined}
              aria-describedby={`${id}-help`}
              autoComplete="off"
              placeholder="Search games…"
              maxLength={100}
              value={query}
              className="game-search-input h-10 min-w-0 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              onClick={() => onOpenChange(true)}
              onChange={(event) => {
                onChange({
                  q: event.target.value.slice(0, 100),
                  year: "",
                  platform: "",
                  all: "",
                  filters: "",
                });
                onOpenChange(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  onOpenChange(true);
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() =>
                      popup.current
                        ?.querySelector<HTMLElement>(".game-catalog-result")
                        ?.focus(),
                    ),
                  );
                } else if (event.key === "Enter" && open) {
                  event.preventDefault();
                  popup.current
                    ?.querySelector<HTMLAnchorElement>(".game-catalog-result")
                    ?.click();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  onOpenChange(false);
                }
              }}
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear search"
                onClick={() => {
                  onChange({
                    q: "",
                    year: "",
                    platform: "",
                    all: "",
                    filters: "",
                  });
                  input.current?.focus();
                }}
              >
                <X className="size-4" />
              </Button>
            )}
            <Popover.Trigger
              aria-label="Show games"
              className="flex h-8 min-w-7 items-center justify-center rounded-md"
            >
              <ChevronDown className="size-4" aria-hidden="true" />
            </Popover.Trigger>
          </div>
          <Popover.Portal>
            <Popover.Positioner
              anchor={anchor}
              positionMethod="fixed"
              sideOffset={8}
              className="game-catalog-positioner z-50"
            >
              <Popover.Popup
                ref={(element) => {
                  popup.current = element;
                  if (typeof bodyRef === "function") bodyRef(element);
                  else if (bodyRef) bodyRef.current = element;
                }}
                id={`${id}-results`}
                className="game-search game-catalog-popup overflow-hidden rounded-lg border border-transparent bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none"
                aria-label="Search results"
                initialFocus={false}
                finalFocus={() => (restoreFocus.current ? finalFocus() : false)}
              >
                <div className="flex items-center justify-between gap-2 border-border border-b px-3 py-1">
                  <p className="text-muted-foreground text-xs">
                    Explore the Catalog
                  </p>
                  <Popover.Close
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Close search"
                      />
                    }
                  >
                    <X className="size-4" />
                  </Popover.Close>
                </div>
                <div className="px-3 py-2">{updates}</div>
                {feedback}
                <div
                  ref={listRef}
                  aria-busy={busy}
                  className="game-catalog-results overflow-y-auto overscroll-contain p-1"
                >
                  {matches.map((game, index) => (
                    <HomeCoverLink
                      key={game.id}
                      gameId={game.id}
                      source="search"
                      cover={
                        <GameCover
                          imageId={game.coverImageId}
                          size="cover_small"
                          className="w-16 max-w-[25%] rounded-md"
                        />
                      }
                      href={`/games/${game.slug}`}
                      prefetch={false}
                      event={[
                        "search_result_opened",
                        { position: positionBucket(index + 1) },
                      ]}
                      onClick={(event) => {
                        if (
                          event.button === 0 &&
                          !event.metaKey &&
                          !event.ctrlKey &&
                          !event.shiftKey &&
                          !event.altKey
                        )
                          onOpenChange(false);
                      }}
                      onAuxClick={(event) => {
                        if (event.button === 1)
                          trackEvent("search_result_opened", {
                            position: positionBucket(index + 1),
                          });
                      }}
                      className="game-catalog-result flex min-h-24 items-center gap-4 rounded-md p-3 outline-none"
                      onKeyDown={(event) => {
                        if (event.key === " ") {
                          event.preventDefault();
                          event.currentTarget.click();
                          return;
                        }
                        const links =
                          popup.current?.querySelectorAll<HTMLAnchorElement>(
                            ".game-catalog-result",
                          );
                        if (!links) return;
                        let next: number;
                        if (event.key === "ArrowDown")
                          next = (index + 1) % links.length;
                        else if (event.key === "ArrowUp")
                          next = (index + links.length - 1) % links.length;
                        else if (event.key === "Home") next = 0;
                        else if (event.key === "End") next = links.length - 1;
                        else return;
                        event.preventDefault();
                        links[next]?.focus();
                      }}
                    >
                      <span className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
                        <span className="font-medium">
                          <bdi>{game.title}</bdi>
                        </span>
                        <span className="text-muted-foreground text-xs">
                          <span className="tabular-nums">
                            {game.year ?? "Year unavailable"}
                          </span>{" "}
                          ·{" "}
                          {game.platforms.join(", ") ||
                            "Platform availability unknown"}
                        </span>
                      </span>
                    </HomeCoverLink>
                  ))}
                </div>
                <p className="border-border border-t px-3 py-2 text-muted-foreground text-xs">
                  {scrollable ? "Scroll to browse all returned matches. " : ""}
                  Choose a game to open its page.
                </p>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <CatalogFilter
          label="Platform"
          value={platform}
          emptyLabel="All platforms"
          options={platforms}
          onChange={(value) => onChange({ platform: value, all: "" })}
        />
        <CatalogFilter
          label="Release year"
          value={year}
          emptyLabel="All years"
          options={years.map(String)}
          onChange={(value) => onChange({ year: value, all: "" })}
        />
        {(year || platform) && (
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => onChange({ year: "", platform: "", all: "" })}
          >
            Clear filters
          </Button>
        )}
      </div>
      <p className="mt-3 text-muted-foreground text-xs">
        Filters narrow up to 50 returned matches.
      </p>
    </section>
  );
}

function CatalogFilter({
  label,
  value,
  emptyLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  emptyLabel: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const unavailable = value && !options.includes(value);
  const items = [
    { value: "", label: emptyLabel },
    ...(unavailable
      ? [{ value, label: `${value} (not in these results)` }]
      : []),
    ...options.map((value) => ({ value, label: value })),
  ];
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(value) => onChange(value ?? "")}
    >
      <SelectTrigger
        aria-label={label}
        className="game-catalog-filter min-h-11 min-w-0 max-w-full flex-1 sm:flex-none"
      >
        <SelectValue className="whitespace-normal [overflow-wrap:anywhere]" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
