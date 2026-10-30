// @vitest-environment jsdom
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { track } from "@vercel/analytics";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DatePrecision } from "@/lib/game-source";
import type { WishlistEntry } from "@/lib/journal";
import { resolveRelease } from "@/lib/release-dates";
import { Wishlist } from "./wishlist";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00"));
});

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
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

test("games are counted and split into out now, upcoming and unannounced, skipping empty sections", () => {
  const { rerender } = render(
    <Wishlist
      entries={[
        entry(1, "2026-10-01T00:00:00Z"),
        entry(2, "2026-10-26T00:00:00Z"),
        entry(3, "2026-12-01T00:00:00Z"),
        entry(4, "2026-01-01T00:00:00Z", "quarter"),
        entry(5, "2027-01-01T00:00:00Z", "year"),
        entry(6, null),
      ]}
    />,
  );

  expect(screen.getByText("6 games")).toBeTruthy();
  const section = (name: RegExp) =>
    within(screen.getByRole("region", { name }))
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
  // Exact dates first, nearest first; a passed quarter is out, a future year isn't.
  expect(section(/^Out now/)).toEqual(["Game 1", "Game 4"]);
  expect(section(/^Upcoming/)).toEqual(["Game 2", "Game 3", "Game 5"]);
  expect(section(/^Release date not announced/)).toEqual(["Game 6"]);
  expect(screen.getByRole("heading", { name: "Out now 2" })).toBeTruthy();

  rerender(<Wishlist entries={[entry(3, "2026-12-01T00:00:00Z")]} />);
  expect(screen.getByText("1 game")).toBeTruthy();
  expect(screen.getAllByRole("region")).toHaveLength(1);
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

/** userEvent waits on real timers; keep only the clock fake. */
function realTimers() {
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00"));
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

test("a released game moves to Backlog or Playing once, then offers its destination and undo", async () => {
  realTimers();
  const user = userEvent.setup();
  const moving = deferred<Date | null>();
  const at = new Date("2026-10-26T12:00:01Z");
  const onMove = vi.fn().mockReturnValueOnce(moving.promise);
  render(
    <Wishlist entries={[entry(7, "2026-10-01T00:00:00Z")]} onMove={onMove} />,
  );

  expect(rows()).toEqual(["Game 7Oct 1, 2026Out nowMove tobacklogplaying"]);
  await user.click(
    screen.getByRole("button", { name: "Move Game 7 to playing" }),
  );
  // Pending: both moves are locked, so a second click can't send a duplicate.
  expect(screen.getByText("Moving Game 7 to Playing…")).toBeTruthy();
  for (const button of screen.getAllByRole("button", { name: /^Move/ }))
    expect((button as HTMLButtonElement).disabled).toBe(true);
  await act(async () => moving.resolve(at));
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(onMove).toHaveBeenCalledWith(7, { status: "wishlist" }, "playing");

  const notice = screen.getByRole("status", { name: "Wishlist updates" });
  expect(notice.textContent).toContain("Moved Game 7 to Playing.");
  expect(
    within(notice)
      .getByRole("link", { name: "Open Playing in Library" })
      .getAttribute("href"),
  ).toBe("/library?status=playing");

  onMove.mockResolvedValueOnce(new Date());
  await user.click(await within(notice).findByRole("button", { name: "Undo" }));
  expect(onMove).toHaveBeenLastCalledWith(
    7,
    { status: "playing", updatedAt: at },
    "wishlist",
  );
  expect(
    await within(notice).findByText("Game 7 is back on your Wishlist."),
  ).toBeTruthy();
});

test("a failed move or undo explains itself in place and can be retried", async () => {
  realTimers();
  const user = userEvent.setup();
  const onMove = vi.fn().mockRejectedValueOnce(new Error("offline"));
  render(
    <Wishlist entries={[entry(7, "2026-10-01T00:00:00Z")]} onMove={onMove} />,
  );

  await user.click(
    screen.getByRole("button", { name: "Move Game 7 to backlog" }),
  );
  const row = screen.getByRole("listitem");
  expect((await within(row).findByRole("alert")).textContent).toContain(
    "Couldn’t move Game 7 to Backlog.",
  );
  onMove.mockResolvedValueOnce(new Date());
  await waitFor(() =>
    expect(
      (
        within(row).getByRole("button", {
          name: "Try again",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  await user.click(within(row).getByRole("button", { name: "Try again" }));
  expect(onMove).toHaveBeenCalledTimes(2);
  expect(onMove).toHaveBeenLastCalledWith(7, { status: "wishlist" }, "backlog");

  const notice = screen.getByRole("status", { name: "Wishlist updates" });
  onMove.mockRejectedValueOnce(new Error("offline"));
  await user.click(await within(notice).findByRole("button", { name: "Undo" }));
  expect((await within(notice).findByRole("alert")).textContent).toContain(
    "Couldn’t put Game 7 back on your Wishlist.",
  );
  onMove.mockResolvedValueOnce(new Date());
  await user.click(
    await within(notice).findByRole("button", { name: "Try again" }),
  );
  await waitFor(() =>
    expect(notice.textContent).toContain("Game 7 is back on your Wishlist."),
  );
});

test("a change made elsewhere stops a move or undo instead of overwriting it", async () => {
  realTimers();
  const user = userEvent.setup();
  const onMove = vi.fn().mockResolvedValueOnce(null);
  render(
    <Wishlist entries={[entry(7, "2026-10-01T00:00:00Z")]} onMove={onMove} />,
  );
  await user.click(
    screen.getByRole("button", { name: "Move Game 7 to backlog" }),
  );
  // The refresh drops the row, so the explanation sits in the notice above the list.
  await waitFor(() =>
    expect(
      within(
        screen.getByRole("status", { name: "Wishlist updates" }),
      ).getByRole("alert").textContent,
    ).toContain("Game 7 isn’t on your Wishlist any more"),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Move Game 7 to backlog",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );

  onMove.mockResolvedValueOnce(new Date()).mockResolvedValueOnce(null);
  await user.click(
    screen.getByRole("button", { name: "Move Game 7 to backlog" }),
  );
  const notice = screen.getByRole("status", { name: "Wishlist updates" });
  await user.click(await within(notice).findByRole("button", { name: "Undo" }));
  await waitFor(() =>
    expect(within(notice).getByRole("alert").textContent).toContain(
      "Game 7 changed after the move, so it was left as is.",
    ),
  );
  expect(
    within(notice)
      .getByRole("link", { name: "Open Game 7" })
      .getAttribute("href"),
  ).toBe("/games/game-7");
});

test("long titles wrap instead of being cut off", () => {
  render(<Wishlist entries={[entry(1, null)]} />);
  const title = screen.getByRole("heading", { name: "Game 1" });
  expect(title.className).not.toContain("truncate");
  expect(title.className).toContain("break-words");
});

test("records a successful move by destination; failures, conflicts and undos record nothing", async () => {
  realTimers();
  const user = userEvent.setup();
  const onMove = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(new Date());
  render(
    <Wishlist
      entries={[
        entry(7, "2026-10-01T00:00:00Z"),
        entry(8, "2026-10-02T00:00:00Z"),
      ]}
      onMove={onMove}
    />,
  );

  await user.click(
    screen.getByRole("button", { name: "Move Game 7 to backlog" }),
  );
  await screen.findByRole("alert");
  expect(track).not.toHaveBeenCalled();

  await user.click(
    screen.getByRole("button", { name: "Move Game 8 to playing" }),
  );
  await waitFor(() =>
    expect(track).toHaveBeenCalledExactlyOnceWith("wishlist_moved", {
      to: "playing",
    }),
  );

  onMove.mockResolvedValueOnce(new Date());
  const notice = screen.getByRole("status", { name: "Wishlist updates" });
  await user.click(await within(notice).findByRole("button", { name: "Undo" }));
  await within(notice).findByText("Game 8 is back on your Wishlist.");
  expect(track).toHaveBeenCalledTimes(1);
});

test("a move that lost to a change elsewhere records nothing", async () => {
  realTimers();
  const user = userEvent.setup();
  render(
    <Wishlist
      entries={[entry(7, "2026-10-01T00:00:00Z")]}
      onMove={vi.fn().mockResolvedValueOnce(null)}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Move Game 7 to backlog" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("status", { name: "Wishlist updates" }).textContent,
    ).not.toBe(""),
  );
  expect(track).not.toHaveBeenCalled();
});
