// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PageTransition } from "./page-transition";

const route = vi.hoisted(() => ({ pathname: "/library" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
afterEach(cleanup);

test("changing routes preserves the router subtree instead of remounting it", () => {
  const children = <input aria-label="Cached page state" defaultValue="kept" />;
  const { rerender } = render(<PageTransition>{children}</PageTransition>);
  const input = screen.getByRole("textbox") as HTMLInputElement;
  input.value = "edited";

  route.pathname = "/wishlist";
  rerender(<PageTransition>{children}</PageTransition>);

  expect(screen.getByRole("textbox")).toBe(input);
  expect(input.value).toBe("edited");
});
