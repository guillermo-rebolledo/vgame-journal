// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Feedback } from "./feedback";

const track = vi.hoisted(() => vi.fn());
vi.mock("@vercel/analytics", () => ({ track }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("feedback is visible only to signed-in users with a username", () => {
  const { rerender } = render(<Feedback username={null} onSubmit={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Send feedback" })).toBeNull();
  rerender(<Feedback username="mario" onSubmit={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Send feedback" })).toBeTruthy();
});

test("submits from the opening pathname, thanks the user, tracks only type once, and resets on reopen", async () => {
  window.history.replaceState({}, "", "/journal?private=secret");
  const submit = vi.fn(async () => undefined);
  render(<Feedback username="mario" onSubmit={submit} />);
  await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
  await userEvent.type(screen.getByLabelText("Message"), "Please add shelves");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("Thanks, got it.")).toBeTruthy();
  expect(submit).toHaveBeenCalledWith({
    type: "idea",
    message: "Please add shelves",
    path: "/journal",
  });
  expect(track.mock.calls).toEqual([["feedback_submitted", { type: "idea" }]]);
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
  expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe(
    "",
  );
});

test("shows rate-limit errors, keeps the draft and emits no analytics", async () => {
  const submit = vi.fn(async () => ({
    error: "You’ve sent 5 messages in the past hour. Please try again later.",
  }));
  render(<Feedback username="mario" onSubmit={submit} />);
  await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
  await userEvent.type(screen.getByLabelText("Message"), "My feedback");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Please try again later",
  );
  expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe(
    "My feedback",
  );
  expect(track).not.toHaveBeenCalled();
});

test("shows a live count near the limit and blocks whitespace-only messages", async () => {
  render(<Feedback username="mario" onSubmit={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
  await userEvent.type(screen.getByLabelText("Message"), "   ");
  expect(
    (
      screen.getByRole("button", {
        name: "Send",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await userEvent.click(screen.getByLabelText("Message"));
  await userEvent.paste("x".repeat(1800));
  expect(screen.getByText("1803 / 2000")).toBeTruthy();
});
