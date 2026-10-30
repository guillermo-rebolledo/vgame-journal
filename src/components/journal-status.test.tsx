// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  await user.click(screen.getByRole("button", { name: "Journal status" }));
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

test("removing an entry records whether it had playthroughs, once confirmed", async () => {
  const user = userEvent.setup();
  renderStatus(
    { status: "played", completionTag: null },
    vi.fn(async () => undefined),
    2,
  );
  await user.click(screen.getByRole("button", { name: "Journal status" }));
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
