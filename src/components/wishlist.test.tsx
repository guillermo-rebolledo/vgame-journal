// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { WishlistEntry } from "@/lib/journal";
import { resolveRelease } from "@/lib/release-dates";
import { Wishlist } from "./wishlist";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const entry = (gameId: number, date: string | null, precision = "day") => ({
  gameId,
  title: `Game ${gameId}`,
  slug: `game-${gameId}`,
  coverImageId: null,
  release: resolveRelease(
    [
      {
        region: "worldwide",
        date: date ? new Date(date) : null,
        precision: precision as "day",
      },
    ],
    "earliest",
  ),
});

test("each game shows its Countdown, Today! or its imprecise label", () => {
  const entries: WishlistEntry[] = [
    entry(1, "2026-10-26T00:00:00Z"),
    entry(2, "2026-11-02T00:00:00Z"),
    entry(3, "2027-09-30T00:00:00Z", "quarter"),
  ];
  render(<Wishlist entries={entries} onMove={vi.fn()} />);

  const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
  expect(rows).toEqual([
    "Game 1Oct 26, 2026Today!",
    "Game 2Nov 2, 20261 week",
    "Game 3Q3 2027",
  ]);
});

test("a released game offers a one-click move to Backlog or Playing", async () => {
  const onMove = vi.fn(async () => {});
  render(
    <Wishlist entries={[entry(7, "2026-10-01T00:00:00Z")]} onMove={onMove} />,
  );

  expect(screen.getByText("Out now")).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", { name: "Move Game 7 to playing" }),
  );
  expect(onMove).toHaveBeenCalledWith(7, "playing");
  expect(
    screen.getByRole("button", { name: "Move Game 7 to backlog" }),
  ).toBeTruthy();
});
