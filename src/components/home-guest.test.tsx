// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { HomeIntroduction, JournalExample } from "./home-guest";

afterEach(cleanup);

test("guests learn what the Journal records before browsing", () => {
  render(<HomeIntroduction />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
    "Track your games",
  );
  expect(screen.getByText(/Keep a Journal/).textContent).toContain(
    "what you’ve played, what you’re playing, and what you want to play",
  );
});

test("the compact illustrative example identifies Backlog and Wishlist without a fabricated countdown", () => {
  render(<JournalExample />);
  const example = within(
    screen.getByRole("figure", { name: "Example Journal" }),
  );
  expect(example.getByText("Backlog")).toBeTruthy();
  expect(example.getByText("Wishlist")).toBeTruthy();
  expect(example.getByText(/Release date not announced/)).toBeTruthy();
  expect(example.getByText(/Illustrative/)).toBeTruthy();
  expect(example.queryByText(/days to go/)).toBeNull();
});
