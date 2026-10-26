// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DatePrecision } from "@/lib/game-source";
import type { WishlistEntry } from "@/lib/journal";
import { resolveRelease } from "@/lib/release-dates";
import { Wishlist } from "./wishlist";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const entry = (
  gameId: number,
  date: string | null,
  precision: DatePrecision = "day",
): WishlistEntry => ({
  gameId,
  title: `Game ${gameId}`,
  slug: `game-${gameId}`,
  coverImageId: null,
  release: resolveRelease(
    [{ region: "worldwide", date: date ? new Date(date) : null, precision }],
    "earliest",
  ),
});

/** Each row's text as a screen reader gets it: the Odometer's rolling digit strips are aria-hidden. */
const rows = () =>
  screen.getAllByRole("listitem").map((li) => {
    const copy = li.cloneNode(true) as HTMLElement;
    for (const hidden of copy.querySelectorAll("[aria-hidden]"))
      hidden.remove();
    return copy.textContent;
  });

test("each game shows its Countdown, Today! or its imprecise label", () => {
  render(
    <Wishlist
      entries={[
        entry(1, "2026-10-26T00:00:00Z"),
        entry(2, "2026-11-02T00:00:00Z"),
        entry(3, "2027-09-30T00:00:00Z", "quarter"),
      ]}
      onMove={vi.fn()}
    />,
  );

  expect(rows()).toEqual([
    "Game 1Oct 26, 2026Today!",
    "Game 2Nov 2, 20261 week",
    "Game 3Q3 2027",
  ]);
});

test("the Countdown ticks over at local midnight", () => {
  render(
    <Wishlist entries={[entry(2, "2026-11-02T00:00:00Z")]} onMove={vi.fn()} />,
  );
  const row = screen.getByRole("listitem");
  expect(within(row).getByText("1 week")).toBeTruthy();

  act(() => vi.advanceTimersByTime(12 * 60 * 60 * 1000));

  expect(within(row).getByText("6 days")).toBeTruthy();
});

test("a released game offers a one-click move to Backlog or Playing", async () => {
  // userEvent waits on real timers; keep only the clock fake.
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00"));
  const onMove = vi.fn(async () => {});
  render(
    <Wishlist entries={[entry(7, "2026-10-01T00:00:00Z")]} onMove={onMove} />,
  );

  expect(rows()).toEqual(["Game 7Oct 1, 2026Out nowMove tobacklogplaying"]);
  await userEvent.click(
    screen.getByRole("button", { name: "Move Game 7 to playing" }),
  );
  expect(onMove).toHaveBeenCalledWith(7, "playing");
  expect(
    screen.getByRole("button", { name: "Move Game 7 to backlog" }),
  ).toBeTruthy();
});
