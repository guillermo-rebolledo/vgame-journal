// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { track } from "@vercel/analytics";
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

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

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
  vi.mocked(track).mockClear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const box = () => screen.getByRole("searchbox", { name: "Search games" });
const status = () => screen.getByRole("status").textContent;
const titles = () =>
  screen.queryAllByRole("link").map((link) => link.textContent);
const until = (n: number) => vi.waitFor(() => expect(requests).toHaveLength(n));

test("retained Home views keep each search and filter correctly labelled", () => {
  window.history.replaceState(null, "", "/?year=2018&platform=PC&filters=1");
  render(
    <>
      <GameSearch guidance="Find a game, then save it to Backlog or Wishlist." />
      <GameSearch guidance="Find a game, then save it to Backlog or Wishlist." />
    </>,
  );
  const searches = screen.getAllByLabelText("Search games", {
    selector: "search",
  });
  expect(searches).toHaveLength(2);
  for (const search of searches) {
    expect(
      within(search).queryAllByRole("searchbox", {
        name: "Search games",
      }),
    ).toHaveLength(1);
    const input = within(search).getByRole("searchbox", {
      name: "Search games",
    });
    const guidance = document.getElementById(
      input.getAttribute("aria-describedby") ?? "",
    );
    expect(guidance?.textContent).toBe(
      "Find a game, then save it to Backlog or Wishlist.",
    );
    for (const name of ["Release year", "Platform"])
      expect(within(search).queryAllByRole("combobox", { name })).toHaveLength(
        1,
      );
  }
});

test("keeps a visible input label and nearby guidance within a named search landmark", async () => {
  const user = userEvent.setup();
  render(
    <GameSearch guidance="Find a game, then save it to Backlog or Wishlist." />,
  );
  const search = screen.getByLabelText("Search games", { selector: "search" });
  expect(within(search).getByLabelText("Search games")).toBe(box());
  const label = within(search).getByText("Search games", { selector: "label" });
  await user.type(box(), "ce");
  expect(label.textContent).toBe("Search games");
  expect(
    document.getElementById(box().getAttribute("aria-describedby") ?? "")
      ?.textContent,
  ).toBe("Find a game, then save it to Backlog or Wishlist.");
  expect(
    screen.getAllByText("Find a game, then save it to Backlog or Wishlist."),
  ).toHaveLength(1);
});

test("waits for two characters, then shows searching and the results", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);

  await user.type(box(), "c");
  expect(requests).toHaveLength(0);
  await user.type(box(), "e");
  expect(status()).toBe("Searching…");
  await until(1);
  await act(async () => requests[0].answer([game(1, "Celeste")]));
  expect(status()).toBe("1 returned match for “ce”.");
  expect(titles()).toEqual(["Celeste"]);
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
  expect(titles()).toEqual(["Celeste"]);
});

test("no results suggests what to try", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);
  await user.type(box(), "zzz");
  await until(1);
  await act(async () => requests[0].answer([]));
  expect(status()).toContain("No matches returned for “zzz”.");
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
  expect(titles()).toEqual(["Celeste"]);
});

test("broad searches show six matches first and let the user expand and collapse", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);
  await user.type(box(), "game");
  await until(1);
  await act(async () =>
    requests[0].answer(
      Array.from({ length: 25 }, (_, i) => game(i + 1, `Game ${i + 1}`)),
    ),
  );
  expect(titles()).toHaveLength(6);
  expect(status()).toBe("25 returned matches for “game”.");
  await user.click(
    screen.getByRole("button", { name: "Show 19 more matches" }),
  );
  expect(titles()).toHaveLength(25);
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
  expect(status()).toBe("2 of 3 returned matches fit your filters.");
  await user.selectOptions(screen.getByLabelText("Platform"), "Switch");
  expect(titles()).toHaveLength(1);
  expect(status()).toBe("1 of 3 returned matches fits your filters.");
  expect(titles()[0]).toContain("Game console");
  await user.selectOptions(screen.getByLabelText("Release year"), "2018");
  expect(status()).toContain("No matches in these results.");
  await user.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(titles()).toHaveLength(3);
  expect(status()).toBe("3 returned matches for “game”.");
  expect(requests).toHaveLength(1);
});

test.each([
  "shared",
  "unknown",
])("omits filters that cannot narrow %s metadata", async (kind) => {
  const user = userEvent.setup();
  render(<GameSearch />);
  await user.type(box(), "game");
  await until(1);
  await act(async () =>
    requests[0].answer(
      [game(1, "Game one"), game(2, "Game two")].map((g) =>
        kind === "unknown" ? { ...g, year: null, platforms: [] } : g,
      ),
    ),
  );
  expect(screen.queryByRole("combobox", { name: "Release year" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Platform" })).toBeNull();
});

test("keeps stale URL filters visible and clearable with a restorable disclosure", async () => {
  window.history.replaceState(
    null,
    "",
    "/?q=game&year=1999&platform=Obsolete&all=1&filters=1",
  );
  const user = userEvent.setup();
  const view = render(<GameSearch />);
  const toggle = () =>
    screen.getByRole("button", { name: "Filters (2 active)" });
  expect(toggle().getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("button", { name: "Clear filters" })).toBeTruthy();
  await until(1);
  await act(async () =>
    requests[0].answer([game(1, "Game one"), game(2, "Game two")]),
  );
  expect(status()).toContain("No matches in these results.");
  expect(
    screen.getByRole("option", { name: "1999 (not in these results)" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("option", { name: "Obsolete (not in these results)" }),
  ).toBeTruthy();
  await user.click(toggle());
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  expect(new URLSearchParams(window.location.search).has("filters")).toBe(
    false,
  );
  view.unmount();
  render(<GameSearch />);
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  await until(2);
  await act(async () =>
    requests[1].answer([game(1, "Game one"), game(2, "Game two")]),
  );
  await user.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(titles()).toHaveLength(2);
  expect((box() as HTMLInputElement).value).toBe("game");
  expect(window.location.search).toBe("?q=game");
  expect(screen.queryByRole("combobox")).toBeNull();
});

test("known and unknown metadata can be narrowed without losing the available choices", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);
  await user.type(box(), "game");
  await until(1);
  await act(async () =>
    requests[0].answer([
      game(1, "Game known"),
      { ...game(2, "Game unknown"), year: null, platforms: [] },
    ]),
  );
  await user.click(screen.getByRole("button", { name: "Filters" }));
  expect(new URLSearchParams(window.location.search).get("filters")).toBe("1");
  await user.selectOptions(screen.getByLabelText("Platform"), "PC");
  expect(titles()).toEqual(["Game known"]);
  expect(screen.getByRole("combobox", { name: "Release year" })).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Release year"), "2018");
  expect(status()).toBe("1 of 2 returned matches fits your filters.");
});

test("unavailable URL criteria remain clearable even when the provider returns no candidates", async () => {
  window.history.replaceState(null, "", "/?q=empty&year=1999&platform=Unknown");
  const user = userEvent.setup();
  render(<GameSearch />);
  await until(1);
  await act(async () => requests[0].answer([]));
  expect(status()).toContain("No matches in these results.");
  await user.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(status()).toContain("No matches returned for “empty”.");
  expect(window.location.search).toBe("?q=empty");
  expect(screen.queryByRole("combobox")).toBeNull();
});

test("finds a matching candidate beyond twenty before limiting the displayed results", async () => {
  window.history.replaceState(null, "", "/?q=quest&year=2024&platform=Switch");
  render(<GameSearch />);
  await until(1);
  await act(async () =>
    requests[0].answer(
      Array.from({ length: 25 }, (_, i) => ({
        ...game(i + 1, `Quest ${i + 1}`),
        year: i === 24 ? 2024 : 2018,
        platforms: i === 24 ? ["Switch"] : ["PC"],
      })),
    ),
  );
  expect(titles()).toEqual(["Quest 25"]);
  expect(status()).toBe("1 of 25 returned matches fits your filters.");
  expect(screen.getByText(/Search returns up to 50 candidates/)).toBeTruthy();
});

test("missing historical year, platforms and cover art never imply an upcoming release", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);
  await user.type(box(), "old");
  await until(1);
  await act(async () =>
    requests[0].answer([{ ...game(1, "Old game"), year: null, platforms: [] }]),
  );
  expect(titles()).toEqual(["Old game"]);
  expect(screen.getByText("Year unavailable")).toBeTruthy();
  expect(screen.getByText("Platform availability unknown")).toBeTruthy();
  expect(screen.queryByText(/TBA|upcoming|announcement/i)).toBeNull();
});

test("reveals full platform availability outside the game link and prioritizes the selected platform", async () => {
  const user = userEvent.setup();
  const longPlatform = "Super Nintendo Entertainment System";
  render(<GameSearch />);
  await user.type(box(), "game");
  await until(1);
  await act(async () =>
    requests[0].answer([
      {
        ...game(1, "Game collection"),
        platforms: ["PC", "Wii", longPlatform, "PlayStation 5"],
      },
      { ...game(2, "Game unknown"), platforms: [] },
      { ...game(3, "Game port"), platforms: ["PC", longPlatform] },
    ]),
  );
  const details = screen.getByLabelText("More platforms for Game collection");
  expect(details.closest("a")).toBeNull();
  await user.click(details);
  expect(details.parentElement?.hasAttribute("open")).toBe(true);
  expect(
    screen.getByRole("link", { name: "Game collection" }).textContent,
  ).toBe("Game collection");
  expect(screen.getByText("Platform availability unknown")).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Platform"), longPlatform);
  const collection = screen
    .getByRole("link", { name: "Game collection" })
    .closest("li");
  expect(collection && within(collection).getByText("SNES")).toBeTruthy();
  expect(
    collection && within(collection).getByText("SNES").closest("details"),
  ).toBeNull();
  expect((screen.getByLabelText("Platform") as HTMLSelectElement).value).toBe(
    longPlatform,
  );
  await user.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(titles()[0]).toBe("Game collection");
  expect(requests).toHaveLength(1);
});

test("restores a shared search including filters and expansion after remount", async () => {
  window.history.replaceState(
    null,
    "",
    "/?q=game&year=2024&platform=Switch&all=1&filters=1",
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
  expect(
    screen
      .getByRole("button", { name: "Filters (2 active)" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
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
  expect(
    screen
      .getByRole("button", { name: "Filters (2 active)" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  await user.clear(box());
  expect(window.location.search).toBe("");
  expect(titles()).toHaveLength(0);
});

test("records one search per settled query, bucketed, without the query text", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);

  await user.type(box(), "secret quest");
  await until(1);
  expect(track).not.toHaveBeenCalled();
  await act(async () =>
    requests[0].answer([
      game(1, "Game"),
      { ...game(2, "Game remake"), year: 2024 },
    ]),
  );

  expect(track).toHaveBeenCalledExactlyOnceWith("game_searched", {
    results: "1-9",
    filtered: false,
  });
  expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toMatch(/secret/);

  await user.selectOptions(screen.getByLabelText("Release year"), "2024");
  expect(track).toHaveBeenLastCalledWith("game_searched", {
    results: "1-9",
    filtered: true,
  });
  expect(track).toHaveBeenCalledTimes(2);
});

test("an empty or failed search records accordingly", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);

  await user.type(box(), "zz");
  await until(1);
  await act(async () => requests[0].answer(null, false));
  expect(track).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Try again" }));
  await until(2);
  await act(async () => requests[1].answer([]));
  expect(track).toHaveBeenCalledExactlyOnceWith("game_searched", {
    results: "0",
    filtered: false,
  });
});

test("opening a result records its position, not the game", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);
  await user.type(box(), "game");
  await until(1);
  await act(async () =>
    requests[0].answer(
      Array.from({ length: 5 }, (_, i) => game(i + 1, `Game ${i + 1}`)),
    ),
  );

  await user.click(screen.getByRole("link", { name: /Game 4/ }));
  expect(track).toHaveBeenLastCalledWith("search_result_opened", {
    position: "4-10",
  });
});
