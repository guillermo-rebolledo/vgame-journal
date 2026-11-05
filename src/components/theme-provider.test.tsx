// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import { afterEach, expect, test, vi } from "vitest";
import { ThemeProvider } from "./theme-provider";

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = "";
  vi.unstubAllGlobals();
});

function appearance(dark = false) {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const media = {
    matches: dark,
    addListener: (listener: (event: { matches: boolean }) => void) =>
      listeners.add(listener),
    removeListener: (listener: (event: { matches: boolean }) => void) =>
      listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => media);
  return (matches: boolean) =>
    act(() => {
      media.matches = matches;
      for (const listener of listeners) listener({ matches });
    });
}

function ThemeChoices() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      {["light", "dark", "system"].map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
        >
          {value}
        </button>
      ))}
    </>
  );
}

test("System follows the OS immediately and when it changes, retaining the choice", async () => {
  const changeOS = appearance();
  render(
    <ThemeProvider>
      <ThemeChoices />
    </ThemeProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "system" }));
  await waitFor(() =>
    expect(document.documentElement.classList.contains("light")).toBe(true),
  );
  expect(
    document.head
      .querySelector('meta[name="theme-color"]')
      ?.getAttribute("content"),
  ).toBe("#ffffff");
  changeOS(true);
  await waitFor(() =>
    expect(document.documentElement.classList.contains("dark")).toBe(true),
  );
  expect(
    document.head
      .querySelector('meta[name="theme-color"]')
      ?.getAttribute("content"),
  ).toBe("#0a0a0a");
  expect(
    screen.getByRole("button", { name: "system" }).getAttribute("aria-pressed"),
  ).toBe("true");
  expect(localStorage.getItem("theme")).toBe("system");
});

test.each([
  "light",
  "dark",
])("explicit %s ignores OS changes and persists after remount", async (value) => {
  const changeOS = appearance();
  const view = render(
    <ThemeProvider>
      <ThemeChoices />
    </ThemeProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: value }));
  changeOS(true);
  changeOS(false);
  expect(document.documentElement.classList.contains(value)).toBe(true);
  expect(
    document.head.querySelectorAll('meta[name="theme-color"]'),
  ).toHaveLength(1);
  expect(
    document.head
      .querySelector('meta[name="theme-color"]')
      ?.getAttribute("content"),
  ).toBe(value === "light" ? "#ffffff" : "#0a0a0a");
  view.unmount();
  render(
    <ThemeProvider>
      <ThemeChoices />
    </ThemeProvider>,
  );
  expect(document.documentElement.classList.contains(value)).toBe(true);
  expect(
    document.head
      .querySelector('meta[name="theme-color"]')
      ?.getAttribute("content"),
  ).toBe(value === "light" ? "#ffffff" : "#0a0a0a");
  expect(
    screen.getByRole("button", { name: value }).getAttribute("aria-pressed"),
  ).toBe("true");
});

test("fresh visitors keep the Dark default even with a Light OS preference", async () => {
  appearance();
  render(
    <ThemeProvider>
      <ThemeChoices />
    </ThemeProvider>,
  );
  await waitFor(() =>
    expect(document.documentElement.classList.contains("dark")).toBe(true),
  );
  expect(
    document.head
      .querySelector('meta[name="theme-color"]')
      ?.getAttribute("content"),
  ).toBe("#0a0a0a");
});
