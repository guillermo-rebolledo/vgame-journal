// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { HomeAuthActions } from "./home-auth-actions";

let params = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => params }));
afterEach(cleanup);

test("both Home account actions retain query, criteria, expansion, and disclosure after URL updates", () => {
  params = new URLSearchParams(
    "q=Final+Fantasy&year=2026&platform=PC&all=1&filters=1",
  );
  const { rerender } = render(<HomeAuthActions />);
  const destination = (name: string) => {
    const link = screen.getByRole<HTMLAnchorElement>("link", { name });
    return new URL(link.href, "http://localhost");
  };
  for (const name of ["Sign up to start a Journal", "Sign in to your Journal"])
    expect(destination(name).searchParams.get("returnTo")).toBe(
      "/?q=Final+Fantasy&year=2026&platform=PC&all=1&filters=1",
    );
  params = new URLSearchParams("q=Celeste&filters=1");
  rerender(<HomeAuthActions />);
  expect(
    destination("Sign in to your Journal").searchParams.get("returnTo"),
  ).toBe("/?q=Celeste&filters=1");
});

test("an unfiltered Home retains ordinary direct auth destinations", () => {
  params = new URLSearchParams();
  render(<HomeAuthActions />);
  expect(
    screen
      .getByRole("link", { name: "Sign up to start a Journal" })
      .getAttribute("href"),
  ).toBe("/sign-up");
  expect(
    screen
      .getByRole("link", { name: "Sign in to your Journal" })
      .getAttribute("href"),
  ).toBe("/sign-in");
});
