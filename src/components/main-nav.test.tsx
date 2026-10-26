// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { MainNav } from "./main-nav";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

afterEach(cleanup);

const current = () =>
  screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

test.each([
  ["/", "Find a game"],
  ["/library", "Library"],
  ["/wishlist", "Wishlist"],
  ["/stats", "Stats"],
])("marks %s as %s", (path, label) => {
  pathname.current = path;
  render(<MainNav />);
  expect(current()).toEqual([label]);
});

test("marks nothing on pages outside the navigation", () => {
  pathname.current = "/games/celeste";
  render(<MainNav />);
  expect(current()).toEqual([]);
  expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
});
