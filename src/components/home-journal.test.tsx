// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { LibraryEntry } from "@/lib/library";
import { HomeCoverTransitions } from "./home-cover-link";
import { HomeJournal } from "./home-journal";

afterEach(cleanup);
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
  addedAt: new Date(
    `2026-10-${String(30 - gameId).padStart(2, "0")}T00:00:00Z`,
  ),
  releasedAt: null,
  platforms: [],
  years: [],
});

test("All saved games and Status subsets precede shelves, including Playing in Recently added", () => {
  const entries = [
    entry(1, "playing"),
    entry(2, "backlog"),
    entry(3, "wishlist"),
    entry(4, "played"),
    entry(5, "playing"),
  ];
  render(<HomeJournal entries={entries} />, { wrapper: HomeCoverTransitions });
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
])("%i saved entries retain useful shortcuts and personal shelves capped at four", (count) => {
  const entries = Array.from({ length: count }, (_, i) =>
    entry(i + 1, "playing"),
  );
  render(<HomeJournal entries={entries} />, { wrapper: HomeCoverTransitions });
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
      expect(shelf.getByRole("link", { name: "Game 1 Playing" })).toBeTruthy();
    }
  }
});

test("confirmed entry updates reconcile aggregate and Status subset counts", () => {
  const { rerender } = render(<HomeJournal entries={[entry(1, "backlog")]} />, {
    wrapper: HomeCoverTransitions,
  });
  expect(screen.getByRole("link", { name: "Backlog (1)" })).toBeTruthy();
  rerender(
    <HomeJournal entries={[entry(1, "wishlist"), entry(2, "playing")]} />,
  );
  expect(
    screen.getByRole("link", { name: "All saved games (2)" }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Backlog (0)" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Wishlist (1)" })).toBeTruthy();
  expect(
    within(screen.getByRole("region", { name: "Recently added" })).getByText(
      "Wishlist",
    ),
  ).toBeTruthy();
});
