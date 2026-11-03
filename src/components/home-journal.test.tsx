// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { homeIntentGame, saveHomeStatus } from "@/app/home-actions";
import type { HomeEntry, HomeSnapshot } from "@/lib/home-journal";
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
  const { rerender } = render(view(initial));
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
  render(
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
    name: "Change status for Celeste",
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
};
const hades: HomeEntry = {
  gameId: 2,
  slug: "hades",
  title: "Hades",
  coverImageId: null,
  status: "backlog",
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
  render(
    <HomeJournalProvider owner="player" initial={Promise.resolve(snapshot([]))}>
      <HomeSaveControls game={celeste} />
      <HomeSaveControls game={hades} />
      <HomeCollections />
    </HomeJournalProvider>,
  );
  await screen.findByRole("link", { name: "Backlog (0)" });
  await user.click(
    screen.getByRole("button", { name: "Add Celeste to backlog" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Add Hades to backlog" }),
  );
  await act(async () =>
    second.resolve({ snapshot: snapshot([hades, celeste]) }),
  );
  await screen.findAllByRole("button", { name: "Change status for Hades" });
  await act(async () => first.resolve({ snapshot: snapshot([celeste]) }));
  expect(screen.getByRole("link", { name: "Backlog (2)" })).toBeTruthy();
  expect(
    screen.getAllByRole("button", { name: "Change status for Hades" }).length,
  ).toBeGreaterThan(0);
  expect(
    screen.getAllByRole("button", { name: "Change status for Celeste" }).length,
  ).toBeGreaterThan(0);
});
