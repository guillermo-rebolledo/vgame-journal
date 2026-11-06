// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { homeIntentGame, saveHomeStatus } from "@/app/home-actions";
import type { HomeEntry, HomeSnapshot } from "@/lib/home-journal";
import type { LibraryEntry } from "@/lib/library";
import { HomeCoverTransitions } from "./home-cover-link";
import {
  HomeCollections,
  HomeJournalProvider,
  HomePendingSave,
  HomeSaveControls,
} from "./home-journal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/app/home-actions", () => ({
  saveHomeStatus: vi.fn(),
  readHomeJournal: vi.fn(),
  homeIntentGame: vi.fn(),
}));
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

test("a same-account return waits for fresh Journal status before offering confirmation", async () => {
  vi.mocked(homeIntentGame).mockResolvedValue(celeste);
  const initial = Promise.resolve(snapshot([celeste]));
  const returned = deferred<HomeSnapshot>();
  const view = (source: Promise<HomeSnapshot>) => (
    <HomeJournalProvider owner="player" initial={source}>
      <HomePendingSave />
      <HomeCollections />
    </HomeJournalProvider>
  );
  const { rerender } = renderHome(view(initial));
  await screen.findByRole("link", { name: "Backlog (1)" });
  window.history.replaceState(
    null,
    "",
    "/?saveGame=1&saveSlug=celeste&saveStatus=wishlist",
  );
  rerender(view(returned.promise));
  await screen.findByRole("heading", { name: "Save Celeste to Wishlist?" });
  expect(
    screen.queryByRole("button", { name: "Confirm Celeste to Wishlist" }),
  ).toBeNull();
  expect(screen.getByText("Checking your Journal…")).toBeTruthy();
  await act(async () =>
    returned.resolve(snapshot([{ ...celeste, status: "played" }])),
  );
  expect(screen.getByText(/Current status: Played/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Confirm Celeste to Wishlist" }),
  ).toBeTruthy();
});

test("confirmation focuses the committed personal shelf when the game is absent from search", async () => {
  const user = userEvent.setup();
  window.history.replaceState(
    null,
    "",
    "/?q=Hades&saveGame=1&saveSlug=celeste&saveStatus=wishlist",
  );
  vi.mocked(homeIntentGame).mockResolvedValue(celeste);
  vi.mocked(saveHomeStatus).mockResolvedValue({
    snapshot: snapshot([{ ...celeste, status: "wishlist" }]),
  });
  // A browser frame can run before a transition commits its new shelf.
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => {
    frame(0);
    return 1;
  });
  renderHome(
    <HomeJournalProvider owner="player" initial={Promise.resolve(snapshot([]))}>
      <input aria-label="Search games" defaultValue="Hades" />
      <HomeSaveControls game={hades} />
      <HomePendingSave />
      <HomeCollections />
    </HomeJournalProvider>,
  );
  await user.click(
    await screen.findByRole("button", { name: "Confirm Celeste to Wishlist" }),
  );
  const change = await screen.findByRole("button", {
    name: /Change status for Celeste$/,
  });
  expect(document.activeElement).toBe(change);
  expect(
    screen.queryByRole("region", { name: "Pending Journal save" }),
  ).toBeNull();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const celeste: HomeEntry = {
  gameId: 1,
  slug: "celeste",
  title: "Celeste",
  coverImageId: null,
  status: "backlog",
  addedAt: new Date("2026-01-01"),
};
const hades: HomeEntry = {
  gameId: 2,
  slug: "hades",
  title: "Hades",
  coverImageId: null,
  status: "backlog",
  addedAt: new Date("2026-01-01"),
};
const snapshot = (entries: HomeEntry[]): HomeSnapshot => ({
  owner: "player",
  entries,
});

test("reversed save responses preserve both games and the Backlog count", async () => {
  const user = userEvent.setup();
  const first = deferred<Awaited<ReturnType<typeof saveHomeStatus>>>();
  const second = deferred<Awaited<ReturnType<typeof saveHomeStatus>>>();
  vi.mocked(saveHomeStatus)
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  renderHome(
    <HomeJournalProvider owner="player" initial={Promise.resolve(snapshot([]))}>
      <HomeSaveControls game={celeste} />
      <HomeSaveControls game={hades} />
      <HomeCollections />
    </HomeJournalProvider>,
  );
  await screen.findByRole("link", { name: "Backlog (0)" });
  await user.click(
    screen.getByRole("button", { name: "Add to backlog for Celeste" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Add to backlog for Hades" }),
  );
  await act(async () =>
    second.resolve({ snapshot: snapshot([hades, celeste]) }),
  );
  await screen.findAllByRole("button", { name: /Change status for Hades$/ });
  await act(async () => first.resolve({ snapshot: snapshot([celeste]) }));
  expect(screen.getByRole("link", { name: "Backlog (2)" })).toBeTruthy();
  expect(
    screen.getAllByRole("button", { name: /Change status for Hades$/ }).length,
  ).toBeGreaterThan(0);
  expect(
    screen.getAllByRole("button", { name: /Change status for Celeste$/ })
      .length,
  ).toBeGreaterThan(0);
});

test("status edits preserve Recently added order and include Playing", async () => {
  const user = userEvent.setup();
  const older = {
    ...celeste,
    addedAt: new Date("2026-01-01"),
    status: "playing" as const,
  };
  const newer = { ...hades, addedAt: new Date("2026-02-01") };
  vi.mocked(saveHomeStatus).mockResolvedValue({
    snapshot: snapshot([newer, { ...older, status: "wishlist" }]),
  });
  renderHome(
    <HomeJournalProvider
      owner="player"
      initial={Promise.resolve(snapshot([newer, older]))}
    >
      <HomeCollections />
    </HomeJournalProvider>,
  );
  const recent = within(
    await screen.findByRole("region", { name: "Recently added" }),
  );
  expect(
    recent
      .getAllByRole("link", { name: /^(Celeste|Hades)$/ })
      .map((link) => link.getAttribute("href")),
  ).toEqual(["/games/hades", "/games/celeste"]);
  await user.click(
    recent.getByRole("button", { name: /Change status for Celeste$/ }),
  );
  await user.click(
    await screen.findByRole("menuitemradio", { name: "Wishlist" }),
  );
  await screen.findByRole("link", { name: "Wishlist (1)" });
  expect(
    recent
      .getAllByRole("link", { name: /^(Celeste|Hades)$/ })
      .map((link) => link.getAttribute("href")),
  ).toEqual(["/games/hades", "/games/celeste"]);
});

function renderHome(ui: Parameters<typeof render>[0]) {
  return render(ui, { wrapper: HomeCoverTransitions });
}

const entry = (
  gameId: number,
  status: LibraryEntry["status"],
): LibraryEntry => ({
  gameId,
  title: `Game ${gameId}`,
  slug: `game-${gameId}`,
  status,
  coverImageId: null,
  completionTag: null,
  rating: null,
  addedAt: new Date(
    `2026-10-${String(30 - gameId).padStart(2, "0")}T00:00:00Z`,
  ),
  releasedAt: null,
  platforms: [],
  years: [],
});

test("All saved games and Status subsets precede shelves, including Playing in Recently added", async () => {
  const entries = [
    entry(1, "playing"),
    entry(2, "backlog"),
    entry(3, "wishlist"),
    entry(4, "played"),
    entry(5, "playing"),
  ];
  renderHome(
    <HomeJournalProvider
      owner="player"
      initial={Promise.resolve(snapshot(entries))}
    >
      <HomeCollections />
    </HomeJournalProvider>,
  );
  await screen.findByRole("link", {
    name: `All saved games (${entries.length})`,
  });
  const all = screen.getByRole("link", { name: "All saved games (5)" });
  expect(all.getAttribute("href")).toBe("/library");
  expect(
    screen.getByRole("link", { name: "Backlog (1)" }).getAttribute("href"),
  ).toBe("/library?status=backlog");
  expect(
    screen.getByRole("link", { name: "Wishlist (1)" }).getAttribute("href"),
  ).toBe("/wishlist");
  expect(
    screen.getByText(/Backlog and Wishlist are Status groups within/),
  ).toBeTruthy();
  const playing = screen.getByRole("region", { name: "Playing" });
  expect(
    all.compareDocumentPosition(playing) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  const recent = within(screen.getByRole("region", { name: "Recently added" }));
  expect(
    recent
      .getAllByRole("link", { name: /^Game/ })
      .map((link) => link.getAttribute("href")),
  ).toEqual([
    "/games/game-1",
    "/games/game-2",
    "/games/game-3",
    "/games/game-4",
  ]);
  expect(
    screen
      .getByRole("link", { name: "View all Playing games" })
      .getAttribute("href"),
  ).toBe("/library?status=playing");
  expect(
    screen
      .getByRole("link", { name: "View all Recently added games" })
      .getAttribute("href"),
  ).toBe("/library?sort=added");
});

test.each([
  0, 1, 2, 6,
])("%i saved entries retain useful shortcuts and personal shelves capped at four", async (count) => {
  const entries = Array.from({ length: count }, (_, i) =>
    entry(i + 1, "playing"),
  );
  renderHome(
    <HomeJournalProvider
      owner="player"
      initial={Promise.resolve(snapshot(entries))}
    >
      <HomeCollections />
    </HomeJournalProvider>,
  );
  await screen.findByRole("link", {
    name: `All saved games (${entries.length})`,
  });
  expect(
    screen.getByRole("link", { name: `All saved games (${count})` }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Backlog (0)" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Wishlist (0)" })).toBeTruthy();
  if (!count) {
    expect(screen.getByText(/Your Journal is empty/)).toBeTruthy();
    expect(screen.queryByRole("region")).toBeNull();
  } else {
    for (const title of ["Playing", "Recently added"]) {
      const shelf = within(screen.getByRole("region", { name: title }));
      expect(shelf.getAllByRole("listitem")).toHaveLength(Math.min(count, 4));
      expect(shelf.getByRole("link", { name: "Game 1" })).toBeTruthy();
      expect(
        shelf.getAllByText("Playing", { exact: true }).length,
      ).toBeGreaterThan(0);
    }
  }
});

test("confirmed entry updates reconcile aggregate and Status subset counts", async () => {
  const view = (entries: LibraryEntry[]) => (
    <HomeJournalProvider
      owner="player"
      initial={Promise.resolve(snapshot(entries))}
    >
      <HomeCollections />
    </HomeJournalProvider>
  );
  const { rerender } = renderHome(view([entry(1, "backlog")]));
  await screen.findByRole("link", { name: "Backlog (1)" });
  rerender(view([entry(1, "wishlist"), entry(2, "playing")]));
  await screen.findByRole("link", { name: "All saved games (2)" });
  expect(screen.getByRole("link", { name: "Backlog (0)" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Wishlist (1)" })).toBeTruthy();
  expect(
    within(screen.getByRole("region", { name: "Recently added" })).getByText(
      "Wishlisted",
    ),
  ).toBeTruthy();
});

test("cancelling a pending save focuses the visible natively labelled Home search", async () => {
  const user = userEvent.setup();
  window.history.replaceState(
    null,
    "",
    "/?saveGame=1&saveSlug=celeste&saveStatus=wishlist",
  );
  vi.mocked(homeIntentGame).mockResolvedValue(celeste);
  renderHome(
    <HomeJournalProvider
      owner={null}
      initial={Promise.resolve({ owner: null, entries: [] })}
    >
      <div hidden>
        <search>
          <label htmlFor="retained-search">Search games</label>
          <input id="retained-search" type="search" />
        </search>
      </div>
      <search>
        <label htmlFor="visible-search">Search games</label>
        <input id="visible-search" type="search" />
      </search>
      <HomePendingSave />
    </HomeJournalProvider>,
  );
  await user.click(
    await screen.findByRole("button", { name: "Cancel pending save" }),
  );
  expect(document.activeElement).toBe(
    screen.getByRole("searchbox", { name: "Search games" }),
  );
  expect(window.location.search).toBe("");
});
