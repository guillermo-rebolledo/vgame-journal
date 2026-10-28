// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { SearchResult } from "@/lib/catalog";
import { GameSearch } from "./game-search";

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          (notify) => {
            window.addEventListener("popstate", notify);
            return () => window.removeEventListener("popstate", notify);
          },
          () => window.location.search,
        ),
      ),
  };
});

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
  window.history.replaceState(null, "", "/");
  // Next's native-history integration notifies useSearchParams subscribers.
  const replace = window.history.replaceState.bind(window.history);
  vi.spyOn(window.history, "replaceState").mockImplementation((...args) => {
    replace(...args);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
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
  vi.restoreAllMocks();
});

const box = () => screen.getByRole("searchbox", { name: "Search games" });
const status = () => screen.getByRole("status").textContent;
const titles = () =>
  screen.queryAllByRole("link").map((link) => link.textContent);
const until = (n: number) => vi.waitFor(() => expect(requests).toHaveLength(n));

test("waits for two characters, then shows searching and the results", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);

  await user.type(box(), "c");
  expect(requests).toHaveLength(0);
  await user.type(box(), "e");
  expect(status()).toBe("Searching…");
  await until(1);
  await act(async () => requests[0].answer([game(1, "Celeste")]));
  expect(status()).toBe("1 game found.");
  expect(titles()).toEqual(["Celeste2018PC"]);
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
  expect(titles()).toEqual(["Celeste2018PC"]);
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
  expect(titles()).toEqual(["Celeste2018PC"]);
});

test("broad searches show six matches first and let the user expand and collapse", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);
  await user.type(box(), "game");
  await until(1);
  await act(async () =>
    requests[0].answer(
      Array.from({ length: 8 }, (_, i) => game(i + 1, `Game ${i + 1}`)),
    ),
  );
  expect(titles()).toHaveLength(6);
  await user.click(screen.getByRole("button", { name: "Show all 8 matches" }));
  expect(titles()).toHaveLength(8);
  await user.click(screen.getByRole("button", { name: "Show fewer matches" }));
  expect(titles()).toHaveLength(6);
});

test("narrows the returned matches by release year and platform and can clear filters", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);
  await user.type(box(), "game");
  await until(1);
  await act(async () =>
    requests[0].answer([
      game(1, "Game original"),
      { ...game(2, "Game remake"), year: 2024 },
      { ...game(3, "Game console"), year: 2024, platforms: ["Switch"] },
    ]),
  );
  await user.selectOptions(screen.getByLabelText("Release year"), "2024");
  expect(titles()).toHaveLength(2);
  await user.selectOptions(screen.getByLabelText("Platform"), "Switch");
  expect(titles()).toHaveLength(1);
  expect(titles()[0]).toContain("Game console");
  await user.selectOptions(screen.getByLabelText("Release year"), "2018");
  expect(status()).toContain("No matches with these filters");
  await user.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(titles()).toHaveLength(3);
  expect(requests).toHaveLength(1);
});

test("restores a shared search including filters and expansion after remount", async () => {
  window.history.replaceState(
    null,
    "",
    "/?q=game&year=2024&platform=Switch&all=1",
  );
  const user = userEvent.setup();
  const view = render(<GameSearch />);
  expect((box() as HTMLInputElement).value).toBe("game");
  await until(1);
  const games = Array.from({ length: 8 }, (_, i) => ({
    ...game(i + 1, `Game ${i + 1}`),
    year: 2024,
    platforms: ["Switch"],
  }));
  await act(async () => requests[0].answer(games));
  expect(titles()).toHaveLength(8);
  expect((screen.getByLabelText("Platform") as HTMLSelectElement).value).toBe(
    "Switch",
  );
  await user.click(screen.getByRole("button", { name: "Show fewer matches" }));
  expect(new URLSearchParams(window.location.search).has("all")).toBe(false);
  view.unmount();
  render(<GameSearch />);
  await until(2);
  await act(async () => requests[1].answer(games));
  expect(titles()).toHaveLength(6);
  await user.clear(box());
  expect(window.location.search).toBe("");
  expect(titles()).toHaveLength(0);
});
