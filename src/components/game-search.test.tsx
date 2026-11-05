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

const box = () => screen.getByRole("combobox", { name: "Search games" });
const status = () => screen.getByRole("status").textContent;
const titles = () =>
  screen
    .queryAllByRole("option")
    .filter((option) => option.closest('[role="listbox"]'))
    .map((option) => option.textContent);
const until = (n: number) => vi.waitFor(() => expect(requests).toHaveLength(n));

test("retained Home views keep each search and filter correctly labelled", () => {
  window.history.replaceState(null, "", "/?year=2018&platform=PC&filters=1");
  render(
    <>
      <GameSearch
        presentation="embedded"
        guidance="Find a game, then save it to Backlog or Wishlist."
      />
      <GameSearch
        presentation="embedded"
        guidance="Find a game, then save it to Backlog or Wishlist."
      />
    </>,
  );
  const searches = screen.getAllByLabelText("Search games", {
    selector: "search",
  });
  expect(searches).toHaveLength(2);
  for (const search of searches) {
    expect(
      within(search).queryAllByRole("combobox", {
        name: "Search games",
      }),
    ).toHaveLength(1);
    const input = within(search).getByRole("combobox", {
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
    <GameSearch
      presentation="embedded"
      guidance="Find a game, then save it to Backlog or Wishlist."
    />,
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
  render(<GameSearch presentation="embedded" />);

  await user.type(box(), "c");
  expect(requests).toHaveLength(0);
  await user.type(box(), "e");
  expect(status()).toBe("Searching…");
  await until(1);
  await act(async () => requests[0].answer([game(1, "Celeste")]));
  expect(status()).toBe("1 returned match for “ce”.");
  expect(titles()).toEqual(["Celeste2018PC"]);
});

test("old results make way while a new search loads, and late answers can't replace newer ones", async () => {
  const user = userEvent.setup();
  render(<GameSearch presentation="embedded" />);
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
  render(<GameSearch presentation="embedded" />);
  await user.type(box(), "zzz");
  await until(1);
  await act(async () => requests[0].answer([]));
  expect(status()).toContain("No matches returned for “zzz”.");
  expect(status()).toContain("Check the spelling");
});

test("a failed search keeps the query and can be retried", async () => {
  const user = userEvent.setup();
  render(<GameSearch presentation="embedded" />);
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

test("broad searches expose every candidate in one list without expanding the page", async () => {
  const user = userEvent.setup();
  render(<GameSearch presentation="embedded" />);
  await user.type(box(), "game");
  await until(1);
  await act(async () =>
    requests[0].answer(
      Array.from({ length: 25 }, (_, i) => game(i + 1, `Game ${i + 1}`)),
    ),
  );
  expect(titles()).toHaveLength(25);
  expect(status()).toBe("25 returned matches for “game”.");
  expect(screen.queryByRole("button", { name: /Show .* matches/ })).toBeNull();
});

test("narrows the returned matches by release year and platform and can clear filters", async () => {
  const user = userEvent.setup();
  render(<GameSearch presentation="embedded" />);
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
  render(<GameSearch presentation="embedded" />);
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
  const view = render(<GameSearch presentation="embedded" />);
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
  render(<GameSearch presentation="embedded" />);
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  await until(2);
  await act(async () =>
    requests[1].answer([game(1, "Game one"), game(2, "Game two")]),
  );
  await user.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(titles()).toHaveLength(2);
  expect((box() as HTMLInputElement).value).toBe("game");
  expect(window.location.search).toBe("?q=game");
  expect(screen.queryByRole("combobox", { name: "Platform" })).toBeNull();
});

test("known and unknown metadata can be narrowed without losing the available choices", async () => {
  const user = userEvent.setup();
  render(<GameSearch presentation="embedded" />);
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
  expect(titles()).toEqual(["Game known2018PC"]);
  expect(screen.getByRole("combobox", { name: "Release year" })).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Release year"), "2018");
  expect(status()).toBe("1 of 2 returned matches fits your filters.");
});

test("unavailable URL criteria remain clearable even when the provider returns no candidates", async () => {
  window.history.replaceState(null, "", "/?q=empty&year=1999&platform=Unknown");
  const user = userEvent.setup();
  render(<GameSearch presentation="embedded" />);
  await until(1);
  await act(async () => requests[0].answer([]));
  expect(status()).toContain("No matches in these results.");
  await user.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(status()).toContain("No matches returned for “empty”.");
  expect(window.location.search).toBe("?q=empty");
  expect(screen.queryByRole("combobox", { name: "Platform" })).toBeNull();
});

test("finds a matching candidate beyond twenty before limiting the displayed results", async () => {
  window.history.replaceState(null, "", "/?q=quest&year=2024&platform=Switch");
  render(<GameSearch presentation="embedded" />);
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
  expect(titles()).toEqual(["Quest 252024Switch"]);
  expect(status()).toBe("1 of 25 returned matches fits your filters.");
  expect(screen.getByText(/Search returns up to 50 candidates/)).toBeTruthy();
});

test("missing historical year, platforms and cover art never imply an upcoming release", async () => {
  const user = userEvent.setup();
  render(<GameSearch presentation="embedded" />);
  await user.type(box(), "old");
  await until(1);
  await act(async () =>
    requests[0].answer([{ ...game(1, "Old game"), year: null, platforms: [] }]),
  );
  expect(titles()).toEqual([
    "Old gameYear unavailablePlatform availability unknown",
  ]);
  expect(screen.getByText("Year unavailable")).toBeTruthy();
  expect(screen.getByText("Platform availability unknown")).toBeTruthy();
  expect(screen.queryByText(/TBA|upcoming|announcement/i)).toBeNull();
});

test("selecting a result exposes its full platform availability outside the View game link", async () => {
  const user = userEvent.setup();
  render(<GameSearch presentation="embedded" renderAction={() => null} />);
  await user.type(box(), "game");
  await until(1);
  await act(async () =>
    requests[0].answer([
      {
        ...game(1, "Game collection"),
        platforms: [
          "PC",
          "Wii",
          "Super Nintendo Entertainment System",
          "PlayStation 5",
        ],
      },
    ]),
  );
  const option = screen.getByRole("option", { name: /^Game collection / });
  expect(within(option).queryByRole("link")).toBeNull();
  expect(within(option).queryByRole("button")).toBeNull();
  expect(within(option).queryByRole("group")).toBeNull();
  await user.click(option);
  const details = screen.getByLabelText(/More platforms for Game collection$/);
  expect(details.closest("a")).toBeNull();
  await user.click(details);
  expect(details.getAttribute("aria-expanded")).toBe("true");
  expect(
    screen.getByRole("list", {
      name: "Additional platforms for Game collection",
    }).textContent,
  ).toBe("WiiSuper Nintendo Entertainment SystemPlayStation 5");
  expect(
    screen
      .getByRole("link", { name: "View game: Game collection" })
      .getAttribute("href"),
  ).toBe("/games/game collection");
});

test("restores a shared search and accepts legacy all without a page expansion control", async () => {
  window.history.replaceState(
    null,
    "",
    "/?q=game&year=2024&platform=Switch&all=1&filters=1",
  );
  const user = userEvent.setup();
  const view = render(<GameSearch presentation="embedded" />);
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
  expect(
    screen.queryByRole("button", { name: "Show fewer matches" }),
  ).toBeNull();
  expect(new URLSearchParams(window.location.search).get("all")).toBe("1");
  view.unmount();
  render(<GameSearch presentation="embedded" />);
  await until(2);
  await act(async () => requests[1].answer(games));
  expect(titles()).toHaveLength(8);
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
  render(<GameSearch presentation="embedded" />);

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
  render(<GameSearch presentation="embedded" />);

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

test("only View game records navigation with the selected position bucket", async () => {
  const user = userEvent.setup();
  render(<GameSearch presentation="embedded" />);
  await user.type(box(), "game");
  await until(1);
  await act(async () =>
    requests[0].answer(
      Array.from({ length: 5 }, (_, i) => game(i + 1, `Game ${i + 1}`)),
    ),
  );

  await user.click(screen.getByRole("option", { name: /^Game 4 / }));
  expect(track).not.toHaveBeenCalledWith(
    "search_result_opened",
    expect.anything(),
  );
  await user.click(screen.getByRole("link", { name: "View game: Game 4" }));
  expect(track).toHaveBeenLastCalledWith("search_result_opened", {
    position: "4-10",
  });
});

test("standalone search opens above the page with a named, always valid result list", async () => {
  const user = userEvent.setup();
  render(<GameSearch />);
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(box());
  const input = screen.getByRole("combobox", { name: "Search games" });
  const list = screen.getByRole("dialog", { name: "Search results" });
  expect(input.getAttribute("aria-controls")).toBe(list.id);
  await vi.waitFor(() => expect(document.activeElement).toBe(input));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.queryByRole("option")).toBeNull();
  expect(status()).toContain("Enter at least 2 characters");
});

test("choosing a result only opens actions and Back restores the query, highlight and scroll", async () => {
  const user = userEvent.setup();
  const save = vi.fn();
  render(
    <GameSearch
      presentation="embedded"
      renderAction={(game) => (
        <button type="button" onClick={() => save(game.id)}>
          Add to list
        </button>
      )}
    />,
  );
  await user.type(
    screen.getByRole("combobox", { name: "Search games" }),
    "game",
  );
  await until(1);
  await act(async () =>
    requests[0].answer([game(1, "Game one"), game(2, "Game two")]),
  );
  await user.keyboard("{ArrowDown}{ArrowDown}");
  const input = screen.getByRole("combobox", { name: "Search games" });
  const highlighted = input.getAttribute("aria-activedescendant");
  const list = screen.getByRole("listbox", { name: "Search results" });
  list.scrollTop = 120;
  await user.keyboard("{Enter}");
  const back = screen.getByRole("button", { name: "Back to results" });
  await vi.waitFor(() => expect(document.activeElement).toBe(back));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Add to list" })).toBeTruthy();
  await user.click(back);
  expect(document.activeElement).toBe(input);
  expect((input as HTMLInputElement).value).toBe("game");
  expect(input.getAttribute("aria-activedescendant")).toBe(highlighted);
  expect(list.scrollTop).toBe(120);
});

test("a shared URL opens once, keeps browsing context on close, and reopens in Search", async () => {
  window.history.replaceState(
    null,
    "",
    "/?q=game&year=2018&filters=1&unrelated=kept#search",
  );
  const user = userEvent.setup();
  render(
    <GameSearch renderAction={() => <button type="button">Save</button>} />,
  );
  const input = await screen.findByRole("combobox", { name: "Search games" });
  await until(1);
  await act(async () => requests[0].answer([game(1, "Game one")]));
  expect(
    screen.getByRole("link", { name: /^Game one/ }).getAttribute("href"),
  ).toBe("/games/game one");
  await user.click(screen.getByRole("button", { name: "Close search" }));
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(window.location.search).toContain("unrelated=kept");
  expect(window.location.hash).toBe("#search");
  await user.click(box());
  expect(screen.queryByRole("button", { name: "Back to results" })).toBeNull();
  expect(
    (screen.getByRole("combobox", { name: "Search games" }) as HTMLInputElement)
      .value,
  ).toBe("game");
  expect(input.getAttribute("aria-controls")).toBeTruthy();
});

test("restored auth intent takes precedence over query-based automatic opening", () => {
  window.history.replaceState(
    null,
    "",
    "/?q=game&saveGame=1&saveSlug=game&saveStatus=backlog",
  );
  render(<GameSearch />);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("shortcuts belong to the visible search and leave composing input and unrelated modals alone", async () => {
  const user = userEvent.setup();
  render(
    <>
      <div hidden>
        <GameSearch />
      </div>
      <GameSearch />
      <div role="dialog" aria-modal="true" aria-label="Other editor">
        <button type="button">Edit</button>
      </div>
    </>,
  );
  const shortcut = new KeyboardEvent("keydown", {
    key: "k",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(shortcut);
  expect(shortcut.defaultPrevented).toBe(false);
  screen.getByRole("dialog", { name: "Other editor" }).hidden = true;
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      isComposing: true,
      bubbles: true,
    }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.keyboard("{Control>}k{/Control}");
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  await vi.waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Search games" })).toBe(
      document.activeElement,
    ),
  );
});

test("an inactive standalone search does not fetch or measure behind an auth continuation", async () => {
  window.history.replaceState(
    null,
    "",
    "/?q=game&saveGame=1&saveSlug=game&saveStatus=backlog",
  );
  render(<GameSearch />);
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(requests).toHaveLength(0);
  expect(track).not.toHaveBeenCalled();
});

test("restored queries respect the endpoint bound and browser navigation restores a closed search", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", `/?q=${"x".repeat(140)}`);
  render(<GameSearch />);
  await until(1);
  expect(requests[0].q).toBe("x".repeat(100));
  expect((box() as HTMLInputElement).value).toBe("x".repeat(100));
  await act(async () => requests[0].answer([]));
  await user.click(screen.getByRole("button", { name: "Close search" }));
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  act(() =>
    window.history.replaceState(null, "", "/?q=game&year=2018&filters=1"),
  );
  await screen.findByRole("dialog");
  expect((box() as HTMLInputElement).value).toBe("game");
  expect(screen.getByLabelText("Release year").textContent).toContain("2018");
});

test("native middle-click View game records only the aggregate navigation bucket", async () => {
  const user = userEvent.setup();
  render(<GameSearch presentation="embedded" renderAction={() => null} />);
  await user.type(box(), "game");
  await until(1);
  await act(async () => requests[0].answer([game(1, "Game one")]));
  await user.click(screen.getByRole("option", { name: /^Game one / }));
  const link = screen.getByRole("link", { name: "View game: Game one" });
  expect(link.getAttribute("target")).toBeNull();
  act(() =>
    link.dispatchEvent(
      new MouseEvent("auxclick", { button: 1, bubbles: true }),
    ),
  );
  expect(track).toHaveBeenLastCalledWith("search_result_opened", {
    position: "1-3",
  });
  expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toContain("Game one");
});

test("browser Back can restore the same retained URL after search was dismissed", async () => {
  window.history.replaceState(null, "", "/?q=game");
  const user = userEvent.setup();
  render(<GameSearch renderAction={() => null} />);
  await screen.findByRole("dialog");
  await user.click(screen.getByRole("button", { name: "Close search" }));
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  act(() => window.dispatchEvent(new PopStateEvent("popstate")));
  await screen.findByRole("dialog");
  expect((box() as HTMLInputElement).value).toBe("game");
});

test("platform choices omit a platform shared by every returned candidate", async () => {
  const user = userEvent.setup();
  render(<GameSearch presentation="embedded" />);
  await user.type(box(), "game");
  await until(1);
  await act(async () =>
    requests[0].answer([
      { ...game(1, "Game one"), platforms: ["PC", "Switch"] },
      game(2, "Game two"),
    ]),
  );
  const platform = screen.getByRole("combobox", { name: "Platform" });
  expect(within(platform).queryByRole("option", { name: "PC" })).toBeNull();
  await user.selectOptions(platform, "Switch");
  expect(titles()).toEqual(["Game one2018PC, Switch"]);
});

test("browser navigation to an auth continuation never reopens an ordinary query dialog", async () => {
  window.history.replaceState(null, "", "/?q=game");
  const user = userEvent.setup();
  render(<GameSearch />);
  await screen.findByRole("dialog");
  await user.click(screen.getByRole("button", { name: "Close search" }));
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  act(() =>
    window.history.replaceState(
      null,
      "",
      "/?q=game&saveGame=1&saveSlug=game&saveStatus=backlog",
    ),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("pending continuation is the single primary search stage, independent of filtered candidates", async () => {
  window.history.replaceState(null, "", "/?q=Other&year=1999&saveGame=1");
  const view = render(
    <GameSearch
      continuation={
        <section aria-label="Pending Journal save">
          <button type="button">Confirm Celeste to Wishlist</button>
        </section>
      }
    />,
  );
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getAllByRole("region", { name: "Pending Journal save" }),
  ).toHaveLength(1);
  await vi.waitFor(() =>
    expect(
      within(dialog).getByRole("button", {
        name: "Confirm Celeste to Wishlist",
      }),
    ).toBe(document.activeElement),
  );
  expect(screen.queryByRole("combobox", { name: "Search games" })).toBeNull();
  expect(requests).toHaveLength(0);
  view.rerender(<GameSearch />);
  await vi.waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Search games" })).toBe(
      document.activeElement,
    ),
  );
});

test("explicit Find a game destination opens once without a query and can reopen the retained owner", async () => {
  window.history.replaceState(null, "", "/?search=1");
  render(
    <>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("catalog-search-open"))}
      >
        Find a game
      </button>
      <GameSearch />
    </>,
  );
  await vi.waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Search games" })).toBe(
      document.activeElement,
    ),
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Close search" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Find a game" }));
  await vi.waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Search games" })).toBe(
      document.activeElement,
    ),
  );
  await user.click(screen.getByRole("button", { name: "Close search" }));
  await vi.waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Find a game" }),
    ),
  );
});

test("a retained hidden continuation cannot open a second dialog", async () => {
  render(
    <div hidden>
      <GameSearch
        continuation={
          <button type="button">Confirm Celeste to Wishlist</button>
        }
      />
    </div>,
  );
  await act(async () => {});
  expect(screen.queryByRole("dialog")).toBeNull();
});
