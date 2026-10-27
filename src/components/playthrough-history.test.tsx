// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { PlaythroughHistory } from "./playthrough-history";

afterEach(cleanup);

test("large histories mount editors only on demand and save the correct playthrough", async () => {
  const user = userEvent.setup();
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onRemove = vi.fn().mockResolvedValue(undefined);
  render(
    <PlaythroughHistory
      playthroughs={Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        gameId: 1,
        userId: "owner",
        platform: "PC",
        startedOn: "2026-01-01",
        endedOn: null,
        hours: 1,
        notes: `Session ${i + 1}`,
      }))}
      platforms={["PC"]}
      onUpdate={onUpdate}
      onRemove={onRemove}
    />,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(48);
  expect(screen.queryByLabelText("Hours")).toBeNull();
  await user.click(screen.getAllByText("Edit", { exact: true })[0]);
  const hours = await screen.findByLabelText("Hours");
  await user.clear(hours);
  await user.type(hours, "2");
  await user.click(screen.getAllByText("Edit", { exact: true })[0]);
  await user.click(screen.getAllByText("Edit", { exact: true })[0]);
  expect((screen.getByLabelText("Hours") as HTMLInputElement).value).toBe("2");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(onUpdate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ hours: "2" }),
    ),
  );
  await user.click(screen.getByRole("button", { name: "Delete playthrough" }));
  await waitFor(() => expect(onRemove).toHaveBeenCalledWith(1));
});
