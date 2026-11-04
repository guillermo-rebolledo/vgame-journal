"use client";

import { useTheme } from "next-themes";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { GameCover } from "@/components/game-cover";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { CommandSearch } from "./command";
import { Inspector } from "./inspector";
import { QuickAdd } from "./quick-add";
import { type DemoState, games } from "./shared";
import "./picker.css";

const names = ["Quick add", "Command", "Inspector"];
const descriptions = [
  "An anchored panel. Save directly from each result and keep searching.",
  "A focused command palette. Find a game, then choose what to do with it.",
  "A floating workspace. Browse compact results with details and actions alongside.",
];

export function SearchPrototype() {
  const [current, setCurrent] = useState(0);
  const [revision, setRevision] = useState(0);
  const [demoState, setDemoState] = useState<DemoState>("ready");
  const picker = useRef<HTMLElement>(null);
  const highlight = useRef<HTMLSpanElement>(null);
  const { resolvedTheme, setTheme } = useTheme();

  const select = useCallback((index: number) => {
    setCurrent(index);
    setRevision((value) => value + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(index + 1));
    window.history.replaceState(null, "", url);
  }, []);
  useEffect(() => {
    const value = Number(new URLSearchParams(window.location.search).get("v"));
    setCurrent(value >= 1 && value <= names.length ? value - 1 : 0);
  }, []);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea, select") || target.isContentEditable)
      )
        return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const number = Number.parseInt(event.key, 10);
      if (number >= 1 && number <= names.length) select(number - 1);
      else if (event.key === "ArrowRight") {
        event.preventDefault();
        select((current + 1) % names.length);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        select((current - 1 + names.length) % names.length);
      } else if (event.key.toLowerCase() === "r")
        setRevision((value) => value + 1);
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [current, select]);
  useLayoutEffect(() => {
    function move() {
      const item = picker.current?.querySelector<HTMLElement>("[data-active]");
      if (item && highlight.current) {
        highlight.current.style.width = `${item.offsetWidth}px`;
        highlight.current.style.transform = `translateX(${item.offsetLeft}px)`;
      }
    }
    move();
    // Also measure after a modal moves the picker into its focus scope.
    const observer = new MutationObserver(move);
    observer.observe(document.body, { subtree: true, childList: true });
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        picker.current?.setAttribute("data-ready", ""),
      ),
    );
    window.addEventListener("resize", move);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", move);
    };
  }, []);
  useLayoutEffect(() => {
    const item =
      picker.current?.querySelectorAll<HTMLElement>(".proto-picker-item")[
        current
      ];
    if (item && highlight.current) {
      highlight.current.style.width = `${item.offsetWidth}px`;
      highlight.current.style.transform = `translateX(${item.offsetLeft}px)`;
    }
  }, [current]);

  const controls = (
    <nav ref={picker} className="proto-picker" aria-label="Prototype variants">
      <span
        ref={highlight}
        className="proto-picker-highlight"
        aria-hidden="true"
      />
      {names.map((name, index) => (
        <button
          key={name}
          type="button"
          className="proto-picker-item"
          data-active={index === current ? "" : undefined}
          aria-current={index === current ? "true" : undefined}
          onClick={() => select(index)}
        >
          {name}
        </button>
      ))}
    </nav>
  );
  const props = { demoState };
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pt-6 pb-28 sm:pt-12">
      <aside
        aria-label="Prototype controls"
        className="flex flex-col gap-3 rounded-lg border border-border p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            SEARCH EXPLORATION · {current + 1} / 3
          </p>
          <Button
            variant="ghost"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            Switch theme
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          <strong className="font-medium text-foreground">
            {names[current]}
          </strong>{" "}
          · {descriptions[current]}
        </p>
        <details>
          <summary className="min-h-6 cursor-pointer rounded-sm text-muted-foreground text-xs outline-offset-2 focus-visible:outline-2">
            Demo controls · sample Catalog, local saves
          </summary>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <Field className="w-auto">
              <FieldLabel htmlFor="demo-state">Search state</FieldLabel>
              <select
                id="demo-state"
                value={demoState}
                className="min-h-11 rounded-md border border-input bg-background px-3 text-base"
                onChange={(event) => {
                  setDemoState(event.target.value as DemoState);
                  setRevision((value) => value + 1);
                }}
              >
                <option value="ready">Results</option>
                <option value="loading">Loading</option>
                <option value="empty">No matches</option>
                <option value="error">Request failed</option>
              </select>
            </Field>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setRevision((value) => value + 1)}
            >
              Reset demo
            </Button>
          </div>
        </details>
      </aside>
      <div className="flex flex-col gap-3">
        <h1 className="font-semibold text-3xl tracking-tight">Your Journal</h1>
        <p className="text-lg text-muted-foreground">
          Find a game to add, or pick up where you left off.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          Find a game, then save it to Backlog or Wishlist.
        </p>
        <div key={`${current}-${revision}`}>
          {current === 0 ? (
            <QuickAdd {...props} />
          ) : current === 1 ? (
            <CommandSearch {...props} picker={controls} />
          ) : (
            <Inspector {...props} />
          )}
        </div>
      </div>
      <section aria-label="Journal context" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-xl">Playing</h2>
          <span className="text-muted-foreground text-xs">
            Your Journal stays in place
          </span>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {games.slice(2, 6).map((game) => (
            <a
              key={game.id}
              href={`/games/${game.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 flex-col gap-3 rounded-lg outline-offset-4 focus-visible:outline-2"
            >
              <GameCover
                imageId={game.image}
                className="w-full rounded-lg shadow-lg"
              />
              <span className="break-words font-medium text-sm">
                {game.title}
              </span>
              <span className="text-muted-foreground text-xs">
                Playing · {game.year}
              </span>
            </a>
          ))}
        </div>
      </section>
      <p className="text-muted-foreground text-xs">
        Try “Hollow”, “Zelda”, “Celeste”, or “ゼルダ”. ⌘/Ctrl K opens search.
        Escape returns you to the Journal.
      </p>
      {current !== 1 && controls}
    </section>
  );
}
