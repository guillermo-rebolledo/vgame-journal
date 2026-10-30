// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { PlaythroughHistory } from "./playthrough-history";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);
test("large histories bound rows and open the selected playthrough on demand", async () => {
  const user = userEvent.setup();
  const onEdit = vi.fn();
  render(
    <PlaythroughHistory
      playthroughs={Array.from({ length: 1000 }, (_, i) => ({
        submissionId: null,
        id: i + 1,
        gameId: 1,
        userId: "owner",
        platform: "PC",
        startedOn: "2026-01-01",
        endedOn: null,
        hours: 1,
        notes: `Session ${i + 1}`,
      }))}
      onEdit={onEdit}
    />,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(48);
  expect(screen.queryByLabelText(/Hours/)).toBeNull();
  await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
  expect(onEdit).toHaveBeenCalledWith(
    expect.objectContaining({ id: 1, notes: "Session 1" }),
  );
});
