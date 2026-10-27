// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { PlatformIcon, PlatformNames } from "./platform";
import { PlaythroughForm } from "./playthrough-form";

afterEach(cleanup);

test.each([
  ["PC", "PC (Microsoft Windows)"],
  ["PC", "Mac"],
  ["PlayStation 5", "PS5"],
  ["PlayStation 5", "PlayStation 4"],
  ["Xbox", "Xbox Series X|S"],
  ["Nintendo Switch", "Switch"],
  ["Nintendo Switch", "Nintendo Switch 2"],
  ["Steam", "Steam Deck"],
  ["iOS", "Android"],
  ["Unknown console", "Dreamcast"],
])("%s and %s use the same platform family icon", (platform, alias) => {
  const { container, rerender } = render(<PlatformIcon platform={platform} />);
  const icon = container.innerHTML;
  rerender(<PlatformIcon platform={alias} />);
  expect(container.innerHTML).toBe(icon);
});

test("platform names stay readable with distinct, decorative icons", () => {
  const platforms = [
    "PC",
    "PS5",
    "Xbox",
    "Nintendo Switch",
    "Android",
    "Other",
  ];
  const { container } = render(<PlatformNames platforms={platforms} />);
  expect(container.textContent).toBe(platforms.join(", "));
  const icons = [...container.querySelectorAll("svg")];
  expect(new Set(icons.map((icon) => icon.innerHTML)).size).toBe(
    platforms.length,
  );
  for (const icon of icons) {
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("focusable")).toBe("false");
  }
  expect(icons[0].classList.contains("lucide-monitor")).toBe(true);
});

test("the picker icon follows selection, survives errors and resets after saving", async () => {
  const user = userEvent.setup();
  const onSave = vi
    .fn()
    .mockResolvedValueOnce({ error: "Try again" })
    .mockResolvedValueOnce(undefined);
  render(
    <PlaythroughForm
      platforms={["PC", "PS5"]}
      initial={{ startedOn: "2026-01-01" }}
      submitLabel="Save"
      onSave={onSave}
    />,
  );
  const picker = () => screen.getByLabelText("Platform") as HTMLSelectElement;
  const icon = () => picker().parentElement?.querySelector("svg");
  const pc = icon()?.innerHTML;
  await user.selectOptions(picker(), "PS5");
  const ps5 = icon()?.innerHTML;
  expect(ps5).not.toBe(pc);
  await user.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("alert");
  expect(picker().value).toBe("PS5");
  expect(icon()?.innerHTML).toBe(ps5);
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(picker().value).toBe("PC"));
  expect(icon()?.innerHTML).toBe(pc);
  expect(onSave).toHaveBeenLastCalledWith(
    expect.objectContaining({ platform: "PS5" }),
  );
});
