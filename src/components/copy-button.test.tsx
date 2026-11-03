// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { track } from "@vercel/analytics";
import { afterEach, expect, test, vi } from "vitest";
import { CopyButton } from "./copy-button";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

test.each([
  "calendar",
  "profile",
  "list",
] as const)("records a copied %s link by target only after the clipboard write succeeds", async (target) => {
  const user = userEvent.setup();
  const writeText = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockRejectedValueOnce(new Error("denied"));
  render(
    <CopyButton
      text="https://x/feed-token.ics"
      inputId="url"
      target={target}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Copy" }));
  await screen.findByRole("alert");
  expect(track).not.toHaveBeenCalled();

  writeText.mockResolvedValueOnce();
  await user.click(screen.getByRole("button", { name: "Copy" }));
  await screen.findByText("Copied");
  expect(track).toHaveBeenCalledExactlyOnceWith("link_copied", {
    target,
  });
});
