// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { SearchResult } from "@/lib/catalog";
import { GameSearch } from "./game-search";

const game = (id: number, title: string): SearchResult => ({
  id,
  title,
  slug: title.toLowerCase(),
  coverImageId: null,
  year: 2018,
  platforms: ["PC"],
});

/** Each fetch waits until the test answers it, in any order; aborts are ignored like a slow network would. */
let requests: { q: string; answer: (body: unknown, ok?: boolean) => void }[];
beforeEach(() => {
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url: string) =>
        new Promise((resolve) => {
          requests.push({
            q: new URL(url, "http://x").searchParams.get("q") ?? "",
            answer: (body, ok = true) =>
              resolve({ ok, statusText: "", json: async () => body }),
          });
        }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const box = () => screen.getByRole("searchbox", { name: "Search games" });
const status = () => screen.getByRole("status").textContent;
const titles = () =>
  screen.queryAllByRole("link").map((link) => link.textContent);
const until = (n: number) => vi.waitFor(() => expect(requests).toHaveLength(n));

test("explains the minimum length, then shows searching and the results", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);
  expect(box().getAttribute("aria-describedby")).toBeTruthy();
  expect(
    screen.getByText("Type at least 2 characters of a game’s title."),
  ).toBeTruthy();

  await user.type(box(), "c");
  expect(requests).toHaveLength(0);
  await user.type(box(), "e");
  expect(status()).toBe("Searching…");
  await until(1);
  await act(async () => requests[0].answer([game(1, "Celeste")]));
  expect(status()).toBe("1 game found.");
  expect(titles()).toEqual(["Celeste 2018PC"]);
});

test("old results make way while a new search loads, and late answers can't replace newer ones", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);
  await user.type(box(), "ce");
  await until(1);
  await act(async () => requests[0].answer([game(1, "Celeste")]));

  await user.type(box(), "l");
  expect(titles()).toEqual([]);
  await until(2);
  await user.type(box(), "e");
  await until(3);
  await act(async () => requests[2].answer([game(1, "Celeste")]));
  await act(async () => requests[1].answer([game(9, "Stale")]));
  expect(titles()).toEqual(["Celeste 2018PC"]);
});

test("no results suggests what to try", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);
  await user.type(box(), "zzz");
  await until(1);
  await act(async () => requests[0].answer([]));
  expect(status()).toContain("No games match “zzz”.");
  expect(status()).toContain("Check the spelling");
});

test("a failed search keeps the query and can be retried", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);
  await user.type(box(), "celeste");
  await until(1);
  await act(async () => requests[0].answer({}, false));
  expect(screen.getByRole("alert").textContent).toContain(
    "Search isn’t working right now.",
  );

  await user.click(screen.getByRole("button", { name: "Try again" }));
  await until(2);
  expect(requests[1].q).toBe("celeste");
  expect((box() as HTMLInputElement).value).toBe("celeste");
  await act(async () => requests[1].answer([game(1, "Celeste")]));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(titles()).toEqual(["Celeste 2018PC"]);
});
