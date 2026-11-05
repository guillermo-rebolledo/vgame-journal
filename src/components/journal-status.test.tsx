// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { track } from "@vercel/analytics";
import { afterEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  type JournalSelection,
  JournalStatus,
  type SaveJournalStatus,
} from "./journal-status";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

function renderStatus(
  entry: JournalSelection,
  onSave: SaveJournalStatus,
  playthroughCount = 0,
) {
  render(
    <TooltipProvider>
      <JournalStatus
        entry={entry}
        gameTitle="Celeste"
        playthroughCount={playthroughCount}
        disabled={false}
        onSave={onSave}
      />
    </TooltipProvider>,
  );
}

async function choose(name: string | RegExp) {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", {
      name: /(?:Add to Journal|Change Journal status) for /,
    }),
  );
  await user.click(await screen.findByRole("menuitemradio", { name }));
}

test("adding a game to the backlog records it as added", async () => {
  const onSave = vi.fn(async () => undefined);
  renderStatus(null, onSave);
  await choose("backlog");
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  await waitFor(() =>
    expect(track).toHaveBeenCalledExactlyOnceWith("journal_status_set", {
      status: "backlog",
      change: "added",
    }),
  );
});

test.each([
  ["played", "Played"],
  ["playing", "Playing"],
  ["backlog", "In backlog"],
  ["wishlist", "Wishlisted"],
] as const)("confirmed %s is visible after the menu closes and announces once", async (status, label) => {
  renderStatus(
    null,
    vi.fn(async () => undefined),
  );
  await choose(status);
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(await screen.findByText(label, { exact: true })).toBeTruthy();
  expect(screen.getAllByRole("status").map((node) => node.textContent)).toEqual(
    [`Celeste: ${label}.`],
  );
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: /Change Journal status for Celeste/ }),
  );
});

test("changing the status of a journal entry records it as changed", async () => {
  renderStatus(
    { status: "playing", completionTag: null },
    vi.fn(async () => undefined),
  );
  await choose("played");
  await waitFor(() =>
    expect(track).toHaveBeenCalledExactlyOnceWith("journal_status_set", {
      status: "played",
      change: "changed",
    }),
  );
});

test("choosing a completion tag records the tag, not another status change", async () => {
  renderStatus(
    { status: "played", completionTag: null },
    vi.fn(async () => undefined),
  );
  await choose("completed");
  await waitFor(() =>
    expect(track).toHaveBeenCalledExactlyOnceWith("completion_tag_set", {
      tag: "completed",
    }),
  );
});

test("a failed save records nothing", async () => {
  const onSave = vi.fn(async () => ({ error: "Nope" }));
  renderStatus(null, onSave);
  await choose("backlog");
  await screen.findByRole("alert");
  const rejected = vi.fn(async () => {
    throw new Error("offline");
  });
  cleanup();
  renderStatus(null, rejected);
  await choose("wishlist");
  await screen.findByRole("alert");
  expect(track).not.toHaveBeenCalled();
});

test("pending and failed changes retain the current Status, then retry announces only confirmed success", async () => {
  let finish!: (result: { error: string } | undefined) => void;
  const onSave = vi.fn(
    () =>
      new Promise<{ error: string } | undefined>((resolve) => {
        finish = resolve;
      }),
  );
  renderStatus({ status: "playing", completionTag: null }, onSave);
  await choose("wishlist");
  expect(screen.getByText("Playing", { exact: true })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("Saving journal status…");
  await act(async () => finish({ error: "Couldn’t save. Try again." }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("Playing", { exact: true })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("");
  await choose("wishlist");
  await act(async () => finish(undefined));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("Celeste: Wishlisted."),
  );
  expect(screen.queryByRole("alert")).toBeNull();
});

test("an unchanged selection produces no save or success announcement", async () => {
  const onSave = vi.fn(async () => undefined);
  renderStatus({ status: "backlog", completionTag: null }, onSave);
  await choose("backlog");
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toBe("");
  expect(screen.getByText("In backlog", { exact: true })).toBeTruthy();
});

test("removing an entry records whether it had playthroughs, once confirmed", async () => {
  const user = userEvent.setup();
  renderStatus(
    { status: "played", completionTag: null },
    vi.fn(async () => undefined),
    2,
  );
  await user.click(
    screen.getByRole("button", {
      name: /(?:Add to Journal|Change Journal status) for /,
    }),
  );
  await user.click(
    await screen.findByRole("menuitem", { name: "Remove from journal" }),
  );
  expect(track).not.toHaveBeenCalled();
  await user.click(
    await screen.findByRole("button", { name: "Remove permanently" }),
  );
  await waitFor(() =>
    expect(track).toHaveBeenCalledExactlyOnceWith("journal_entry_removed", {
      had_playthroughs: true,
    }),
  );
});

test("the current Status and Completion tag appear only in the action", () => {
  renderStatus({ status: "played", completionTag: "completed" }, vi.fn());
  const trigger = screen.getByRole("button", {
    name: "Played · Completed — Change Journal status for Celeste",
  });
  expect(trigger.textContent).toBe("Played · Completed");
  expect(
    screen.getAllByText("Played · Completed", { exact: true }),
  ).toHaveLength(1);
});
