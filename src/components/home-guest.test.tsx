// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { HomeIntroduction, JournalExample } from "./home-guest";

afterEach(cleanup);

test("guests learn the tasks and collection vocabulary before browsing", () => {
  render(<HomeIntroduction />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
    "Track what you’re playing, build your backlog, and save games you want",
  );
  expect(
    screen.getByText(/Journal is your saved game record/).textContent,
  ).toContain("Library includes all saved games");
  expect(screen.getByText(/Status groups/).textContent).toContain(
    "Played, Playing, Backlog, and Wishlist",
  );
  expect(screen.getByText(/Wishlist holds/).textContent).toContain(
    "released and upcoming games",
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
