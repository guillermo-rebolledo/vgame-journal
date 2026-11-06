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
      onRate={vi.fn(async () => undefined)}
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

test("a saved game remains visibly Playing with separate empty Playthrough guidance", () => {
  renderRecording();
  expect(screen.getByText("Playing", { exact: true })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Playthroughs" })).toBeTruthy();
  expect(screen.getByText("No playthroughs yet.")).toBeTruthy();
});

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

test.each([
  "played",
  "playing",
] as const)("a %s game offers the rating control with the saved Rating", (status) => {
  renderRecording({ entry: { status, completionTag: null }, rating: 7 });
  expect(screen.getByRole("group", { name: "Your rating" })).toBeTruthy();
  expect(
    (
      screen.getByRole("radio", {
        name: "3.5 stars out of 5",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
});

test.each([
  "backlog",
  "wishlist",
] as const)("a %s game shows a kept Rating read-only and no control without one", (status) => {
  renderRecording({ entry: { status, completionTag: null }, rating: 7 });
  expect(screen.queryAllByRole("radio")).toHaveLength(0);
  expect(screen.getByText("Rated 3.5 out of 5")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Clear rating" })).toBeTruthy();
  cleanup();
  renderRecording({ entry: { status, completionTag: null }, rating: null });
  expect(screen.queryByRole("group", { name: "Your rating" })).toBeNull();
});

test("a game outside the journal shows no rating control", () => {
  renderRecording({ entry: null });
  expect(screen.queryByRole("group", { name: "Your rating" })).toBeNull();
});

test("a guest gets one Sign in, for recording and rating, returning to the game", () => {
  renderRecording({ signedIn: false, entry: null });
  expect(screen.queryByRole("link", { name: "Sign in to rate" })).toBeNull();
  const signIn = screen.getByRole("link", { name: "Sign in" });
  expect(signIn.getAttribute("href")).toBe(
    "/sign-in?returnTo=%2Fgames%2Fceleste",
  );
  expect(signIn.parentElement?.textContent).toBe(
    "Sign in to record and rate games and add playthroughs.",
  );
});

test("rating saves through onRate", async () => {
  const user = userEvent.setup();
  const onRate = vi.fn(async () => undefined);
  renderRecording({ entry: { status: "played", completionTag: null }, onRate });
  await user.click(screen.getByRole("radio", { name: "4 stars out of 5" }));
  expect(onRate).toHaveBeenCalledExactlyOnceWith(8);
});

test("clearing a kept Rating outside Played or Playing hands focus to Journal status and announces once", async () => {
  const user = userEvent.setup();
  let resolve = () => {};
  const onRate = vi.fn(
    () => new Promise<undefined>((r) => (resolve = () => r(undefined))),
  );
  renderRecording({
    entry: { status: "backlog", completionTag: null },
    rating: 7,
    onRate,
  });
  await user.click(screen.getByRole("button", { name: "Clear rating" }));
  expect(onRate).toHaveBeenCalledExactlyOnceWith(null);
  // While it saves, focus stays in the control rather than dropping to the page.
  expect(
    screen
      .getByRole("group", { name: "Your rating" })
      .contains(document.activeElement),
  ).toBe(true);
  resolve();
  await waitFor(() =>
    expect(screen.queryByRole("group", { name: "Your rating" })).toBeNull(),
  );
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: /Change Journal status for Celeste/ }),
  );
  const status = document.querySelector('[data-slot="rating-status"]');
  expect(status?.textContent).toBe("Celeste: Rating cleared.");
});
