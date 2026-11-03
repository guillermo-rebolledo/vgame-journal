// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DatePrecision } from "@/lib/game-source";
import type { WishlistEntry } from "@/lib/journal";
import { compareWishlist, resolveRelease } from "@/lib/release-dates";
import { HomeWishlistPreview } from "./home-wishlist-preview";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const entry = (
  id: number,
  date: string | null,
  precision: DatePrecision = "day",
): WishlistEntry => ({
  gameId: id,
  title: `Game ${id}`,
  slug: `game-${id}`,
  coverImageId: null,
  release: resolveRelease(
    [{ region: "worldwide", date: date ? new Date(date) : null, precision }],
    "earliest",
  ),
});

test("selects the first upcoming release in Wishlist order, excluding Out now and keeping Today eligible", () => {
  const entries = [
    entry(1, "2026-10-01"),
    entry(2, "2026-10-26"),
    entry(3, "2026-11-01"),
    entry(4, null),
  ].sort(compareWishlist);
  render(<HomeWishlistPreview entries={entries} />);
  expect(
    screen.getByRole("link", { name: "Game 2" }).getAttribute("href"),
  ).toBe("/games/game-2");
  expect(screen.getByText("Today!")).toBeTruthy();
  expect(screen.queryByText("Game 1")).toBeNull();
  expect(screen.queryByText("Game 4")).toBeNull();
});

test("falls back to the first undated title ahead of an Out now-only summary", () => {
  const entries = [entry(1, "2026-10-01"), entry(2, null), entry(3, null)].sort(
    compareWishlist,
  );
  const { rerender } = render(<HomeWishlistPreview entries={entries} />);
  expect(screen.getByRole("link", { name: "Game 2" })).toBeTruthy();
  expect(screen.getByText("Release date not announced")).toBeTruthy();
  expect(screen.queryByText("Game 3")).toBeNull();
  rerender(
    <HomeWishlistPreview
      entries={[entry(1, "2026-10-01"), entry(5, "2026-01-01", "quarter")]}
    />,
  );
  expect(
    screen
      .getByRole("link", { name: "2 Wishlist games out now" })
      .getAttribute("href"),
  ).toBe("/wishlist#wishlist-out");
  expect(screen.queryByText("Next on your Wishlist")).toBeNull();
  rerender(<HomeWishlistPreview entries={[]} />);
  expect(
    screen.queryByRole("region", { name: "Wishlist release preview" }),
  ).toBeNull();
});

test.each([
  ["month", "2026-11-01", "November 2026"],
  ["quarter", "2027-07-01", "Q3 2027"],
  ["year", "2027-01-01", "2027"],
] as const)("%s precision shows its release label without inventing a day countdown", (precision, date, label) => {
  render(<HomeWishlistPreview entries={[entry(1, date, precision)]} />);
  expect(screen.getByText(label)).toBeTruthy();
  expect(screen.queryByText(/\d+ (?:day|week|month)s?/)).toBeNull();
});

test("exact releases show the Countdown and advance at the user's local midnight", () => {
  const { rerender } = render(
    <HomeWishlistPreview entries={[entry(1, "2026-10-27"), entry(2, null)]} />,
  );
  expect(screen.getByText("1 day")).toBeTruthy();
  act(() => vi.advanceTimersByTime(12 * 60 * 60 * 1000));
  expect(screen.getByText("Today!")).toBeTruthy();
  act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
  expect(screen.queryByText("Game 1")).toBeNull();
  expect(screen.getByRole("link", { name: "Game 2" })).toBeTruthy();
  rerender(<HomeWishlistPreview entries={[entry(1, "2026-10-27")]} />);
  expect(
    screen.getByRole("link", { name: "1 Wishlist game out now" }),
  ).toBeTruthy();
});
