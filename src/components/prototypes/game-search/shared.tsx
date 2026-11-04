"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Popover } from "@base-ui/react/popover";
import { ArrowUpRight, Check, ChevronDown, Search, X } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { GameCover } from "@/components/game-cover";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export const games = [
  {
    id: 1,
    title: "Hollow Knight",
    slug: "hollow-knight",
    year: 2017,
    platforms: "PC · Switch · PS4 · Xbox One",
    image: "cobfzp",
  },
  {
    id: 2,
    title: "Hollow Knight: Silksong",
    slug: "hollow-knight-silksong",
    year: 2025,
    platforms: "PC · Switch · PS5 · Xbox Series",
    image: "cobebu",
  },
  {
    id: 3,
    title: "Hades",
    slug: "hades--1",
    year: 2020,
    platforms: "PC · Switch · PS5 · Xbox Series",
    image: "cob9kr",
  },
  {
    id: 4,
    title: "Celeste",
    slug: "celeste",
    year: 2018,
    platforms: "PC · Switch · PS4 · Xbox One",
    image: "co3byy",
  },
  {
    id: 5,
    title: "Dead Cells",
    slug: "dead-cells",
    year: 2018,
    platforms: "PC · Switch · PS4 · Xbox One",
    image: "co7jfv",
  },
  {
    id: 6,
    title: "Slay the Spire",
    slug: "slay-the-spire",
    year: 2019,
    platforms: "PC · Switch · PS4 · Xbox One",
    image: "co1iyf",
  },
  {
    id: 7,
    title: "The Legend of Zelda: Tears of the Kingdom",
    slug: "the-legend-of-zelda-tears-of-the-kingdom",
    year: 2023,
    platforms: "Switch · Switch 2",
    image: "co5vmg",
  },
  {
    id: 8,
    title: "ゼルダの伝説 — an adventure without cover art",
    slug: "missing-cover-demo",
    year: null,
    platforms: "Platform availability unknown",
    image: null,
  },
] satisfies Game[];

export type Game = {
  id: number;
  title: string;
  slug: string;
  year: number | null;
  platforms: string;
  image: string | null;
};
export const statuses = ["Backlog", "Wishlist", "Playing", "Played"] as const;
export type Status = (typeof statuses)[number];
export type DemoState = "ready" | "loading" | "empty" | "error";
export type VariantProps = {
  demoState?: DemoState;
  defaultOpen?: boolean;
  initialQuery?: string;
};

export function useSearchDemo({
  demoState = "ready",
  initialQuery = "",
}: VariantProps) {
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState(demoState);
  const [saved, setSaved] = useState<Record<number, Status>>({ 3: "Playing" });
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (state !== "loading") return;
    const timer = setTimeout(() => setState("ready"), 900);
    return () => clearTimeout(timer);
  }, [state]);
  const matches =
    state === "empty"
      ? []
      : games.filter((game) =>
          game.title
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
        );
  function save(game: Game, status: Status) {
    setSaved((previous) => ({ ...previous, [game.id]: status }));
    setMessage(`${game.title} saved to ${status}.`);
  }
  return {
    query,
    setQuery,
    state,
    setState,
    matches,
    saved,
    save,
    message,
    setMessage,
  };
}
export type Demo = ReturnType<typeof useSearchDemo>;

export function SearchTrigger() {
  return (
    <>
      <Search aria-hidden="true" />
      <span className="flex-1 text-start">Search games…</span>
      <span aria-hidden="true" className="text-xs">
        ⌘ K
      </span>
    </>
  );
}

export function useSearchShortcut(setOpen: (open: boolean) => void) {
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [setOpen]);
}

export function SearchField({
  demo,
  combobox = false,
}: {
  demo: Demo;
  combobox?: boolean;
}) {
  const id = useId();
  const props = {
    id,
    placeholder: "Search games…",
    className: "h-11 pl-10 pr-12",
    autoComplete: "off",
    spellCheck: false,
  };
  return (
    <div className="relative m-3">
      <label htmlFor={id} className="sr-only">
        Search games
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
      />
      {combobox ? (
        <Combobox.Input {...props} render={<Input />} />
      ) : (
        <Input
          {...props}
          type="search"
          value={demo.query}
          onChange={(event) => demo.setQuery(event.target.value)}
        />
      )}
      {demo.query && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1.5 right-1.5"
          aria-label="Clear search"
          onClick={() => {
            demo.setQuery("");
            document.getElementById(id)?.focus();
          }}
        >
          <X />
        </Button>
      )}
    </div>
  );
}

export function SearchState({
  demo,
  children,
}: {
  demo: Demo;
  children: ReactNode;
}) {
  if (demo.state === "loading")
    return (
      <output className="px-4 py-10 text-center text-muted-foreground">
        Searching the Catalog…
      </output>
    );
  if (demo.state === "error")
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-4">
        <p>Search isn’t working right now. Your search is kept.</p>
        <Button variant="outline" onClick={() => demo.setState("loading")}>
          Try again
        </Button>
      </div>
    );
  if (!demo.matches.length)
    return (
      <div className="flex flex-col gap-3 p-6">
        <p>No matches for “{demo.query || "your search"}”.</p>
        <p className="text-muted-foreground">
          Try another title or check the spelling.
        </p>
        <Button
          variant="outline"
          className="self-start"
          onClick={() => {
            demo.setQuery("");
            demo.setState("ready");
          }}
        >
          Clear search
        </Button>
      </div>
    );
  return children;
}

export function GameIdentity({ game }: { game: Game }) {
  return (
    <>
      <GameCover
        imageId={game.image}
        size="cover_small"
        className="w-9 rounded-sm"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-start">
        <span className="break-words font-medium">
          <bdi>{game.title}</bdi>
        </span>
        <span className="text-muted-foreground text-xs">
          {game.year ?? "Year unavailable"} · {game.platforms}
        </span>
      </span>
    </>
  );
}

export function GameLink({ game }: { game: Game }) {
  if (game.id === 8)
    return (
      <p className="text-muted-foreground text-xs">
        Sample game · no detail page
      </p>
    );
  return (
    <a
      href={`/games/${game.slug}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm underline underline-offset-4 outline-offset-2 focus-visible:outline-2"
    >
      View game
      <ArrowUpRight aria-hidden="true" className="size-4" />
      <span className="sr-only"> for {game.title} (opens a new tab)</span>
    </a>
  );
}

export function RowActions({ game, demo }: { game: Game; demo: Demo }) {
  const status = demo.saved[game.id];
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useLayoutEffect(() => {
    if (status && restoreFocus.current) {
      trigger.current?.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [status]);
  return status ? (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            ref={trigger}
            variant="outline"
            press="static"
            className="min-h-11"
            aria-label={`${status}: change status for ${game.title}`}
          />
        }
      >
        <Check />
        {status}
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Status for {game.title}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={status}>
            {statuses.map((value) => (
              <DropdownMenuRadioItem
                key={value}
                value={value}
                closeOnClick
                className="min-h-11"
                onClick={() => demo.save(game, value)}
              >
                {value}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        className="min-h-11"
        aria-label={`Add to backlog for ${game.title}`}
        onClick={() => {
          restoreFocus.current = true;
          demo.save(game, "Backlog");
        }}
      >
        Backlog
      </Button>
      <Button
        variant="ghost"
        className="min-h-11"
        aria-label={`Add to wishlist for ${game.title}`}
        onClick={() => {
          restoreFocus.current = true;
          demo.save(game, "Wishlist");
        }}
      >
        Wishlist
      </Button>
    </div>
  );
}

export function DetailActions({ game, demo }: { game: Game; demo: Demo }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        {demo.saved[game.id]
          ? `In your Journal · ${demo.saved[game.id]}`
          : "Add to your Journal"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {statuses.map((status) => (
          <Button
            key={status}
            variant={demo.saved[game.id] === status ? "default" : "outline"}
            className="min-h-11 transition-none"
            aria-label={`Save to ${status} for ${game.title}`}
            aria-pressed={demo.saved[game.id] === status}
            onClick={() => demo.save(game, status)}
          >
            {demo.saved[game.id] === status && <Check />}
            {status}
          </Button>
        ))}
      </div>
      <GameLink game={game} />
    </div>
  );
}

export function SearchFooter({ demo, hint }: { demo: Demo; hint: string }) {
  return (
    <>
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-muted-foreground text-xs">
        <span>{hint}</span>
        <span>esc to close</span>
      </div>
      <output
        aria-live="polite"
        className="block px-4 pb-3 text-sm empty:hidden"
      >
        {demo.message}
      </output>
    </>
  );
}

export function AnchoredSearch({
  open,
  setOpen,
  children,
  wide = false,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const input = useRef<HTMLDivElement>(null);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <Button
            variant="outline"
            press="static"
            className="h-12 w-full justify-start gap-3"
          />
        }
      >
        <SearchTrigger />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50"
          side="bottom"
        >
          <Popover.Popup
            className={`popup-transition flex max-h-[min(28rem,var(--available-height))] w-[min(var(--anchor-width),calc(100vw-2rem))] origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-transparent bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none ${wide ? "sm:w-[min(48rem,calc(100vw-2rem))]" : ""}`}
            initialFocus={() => input.current?.querySelector("input") ?? false}
          >
            <Popover.Title className="sr-only">
              Search the Catalog
            </Popover.Title>
            <Popover.Description className="sr-only">
              Find a game and choose its Status in your Journal.
            </Popover.Description>
            <div ref={input} className="flex min-h-0 flex-col">
              {children}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
