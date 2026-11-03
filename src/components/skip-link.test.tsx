// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { SkipLink } from "./skip-link";

afterEach(cleanup);

test("Skip to main content moves focus and scrolling past the header, then Tab enters main", async () => {
  render(
    <>
      <SkipLink />
      <header>
        <a href="/">Brand</a>
      </header>
      <main id="main-content" tabIndex={-1}>
        <input aria-label="Search games" />
      </main>
    </>,
  );
  const user = userEvent.setup();
  const main = screen.getByRole("main");
  const scroll = vi.fn();
  main.scrollIntoView = scroll;
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("link", { name: "Skip to main content" }),
  );
  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(main);
  expect(scroll).toHaveBeenCalledOnce();
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: "Search games" }),
  );
});
