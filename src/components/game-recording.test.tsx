// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { track } from "@vercel/analytics";
import { afterEach, expect, test, vi } from "vitest";
import type { playthrough } from "@/db/schema";
import { GameRecording } from "./game-recording";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/games/celeste",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

const logged: typeof playthrough.$inferSelect = {
  id: 7,
  userId: "u1",
  gameId: 1,
  platform: "PC",
  startedOn: "2026-01-02",
  endedOn: null,
  hours: null,
  notes: "",
  submissionId: null,
};

function renderRecording(
  props: Partial<Parameters<typeof GameRecording>[0]> = {},
) {
  render(
    <GameRecording
      signedIn
      entry={{ status: "playing", completionTag: null }}
      playthroughs={[]}
      gameTitle="Celeste"
      platforms={["PC"]}
      onStatus={vi.fn(async () => undefined)}
      onAdd={vi.fn(async () => undefined)}
      onUpdate={vi.fn(async () => undefined)}
      onRemove={vi.fn(async () => undefined)}
      {...props}
    />,
  );
}

async function addPlaythrough(notes: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Add playthrough" }));
  fireEvent.change(await screen.findByLabelText("Started"), {
    target: { value: "2026-01-02" },
  });
  if (notes)
    await user.type(screen.getByLabelText("Notes (private, optional)"), notes);
  await user.click(screen.getByRole("button", { name: "Save" }));
}

test("adding a playthrough records whether it has notes and hours, never the notes", async () => {
  const onAdd = vi.fn(async () => undefined);
  renderRecording({ onAdd });
  await addPlaythrough("secret ending");
  await waitFor(() => expect(onAdd).toHaveBeenCalled());
  await waitFor(() =>
    expect(track).toHaveBeenCalledExactlyOnceWith("playthrough_added", {
      has_notes: true,
      has_hours: false,
    }),
  );
  expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toMatch(/secret/);
});

test("a playthrough for a game outside the journal also records it as added", async () => {
  renderRecording({ entry: null });
  await addPlaythrough("");
  await waitFor(() => expect(track).toHaveBeenCalledTimes(2));
  expect(track).toHaveBeenCalledWith("journal_status_set", {
    status: "playing",
    change: "added",
  });
  expect(track).toHaveBeenCalledWith("playthrough_added", {
    has_notes: false,
    has_hours: false,
  });
});

test("a failed save records nothing", async () => {
  renderRecording({ onAdd: vi.fn(async () => ({ error: "Nope" })) });
  await addPlaythrough("x");
  await screen.findByRole("alert");
  expect(track).not.toHaveBeenCalled();
});

test("deleting a playthrough records it once it's gone", async () => {
  const user = userEvent.setup();
  const onRemove = vi.fn(async () => undefined);
  renderRecording({ playthroughs: [logged], onRemove });
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(
    await screen.findByRole("button", { name: "Delete playthrough" }),
  );
  await waitFor(() =>
    expect(track).toHaveBeenCalledExactlyOnceWith(
      "playthrough_removed",
      undefined,
    ),
  );
});
