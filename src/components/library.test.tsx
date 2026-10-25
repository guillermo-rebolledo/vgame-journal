// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import type { LibraryEntry } from "@/lib/library";
import { Library } from "./library";

afterEach(cleanup);

const entry = (e: Partial<LibraryEntry> & Pick<LibraryEntry, "gameId">) => ({
  title: `Game ${e.gameId}`,
  slug: `game-${e.gameId}`,
  coverImageId: null,
  status: "backlog" as const,
  completionTag: null,
  addedAt: new Date("2026-01-01"),
  releasedAt: null,
  platforms: [],
  years: [],
  ...e,
});

const entries: LibraryEntry[] = [
  entry({
    gameId: 1,
    title: "Hollow Knight",
    status: "played",
    completionTag: "completed",
    addedAt: new Date("2026-03-01"),
    platforms: ["Nintendo Switch"],
    years: [2023],
  }),
  entry({
    gameId: 2,
    title: "Celeste",
    status: "played",
    addedAt: new Date("2026-02-01"),
    platforms: ["PC"],
    years: [2024],
  }),
  entry({
    gameId: 3,
    title: "Elden Ring",
    status: "playing",
    addedAt: new Date("2026-01-01"),
    platforms: ["PC"],
    years: [2024, 2025],
  }),
];

const titles = () =>
  within(screen.getByRole("list", { name: "Games" }))
    .getAllByRole("heading")
    .map((h) => h.textContent);

test("filter and sort controls change the visible games", async () => {
  const user = userEvent.setup();
  render(<Library entries={entries} initialView="grid" />);
  expect(titles()).toEqual(["Hollow Knight", "Celeste", "Elden Ring"]);

  await user.selectOptions(screen.getByLabelText("Status"), "Played");
  expect(titles()).toEqual(["Hollow Knight", "Celeste"]);

  await user.selectOptions(screen.getByLabelText("Sort by"), "Title");
  expect(titles()).toEqual(["Celeste", "Hollow Knight"]);

  await user.selectOptions(screen.getByLabelText("Platform"), "PC");
  expect(titles()).toEqual(["Celeste"]);

  await user.selectOptions(screen.getByLabelText("Status"), "All statuses");
  await user.selectOptions(screen.getByLabelText("Year played"), "2025");
  expect(titles()).toEqual(["Elden Ring"]);

  await user.selectOptions(
    screen.getByLabelText("Platform"),
    "Nintendo Switch",
  );
  expect(screen.queryByRole("list", { name: "Games" })).toBeNull();
  expect(screen.getByText(/no games match/i)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /clear filters/i }));
  expect(titles()).toEqual(["Celeste", "Elden Ring", "Hollow Knight"]);
});

test("the grid or list choice is remembered", async () => {
  const user = userEvent.setup();
  render(<Library entries={entries} initialView="grid" />);

  await user.click(screen.getByRole("button", { name: "List" }));
  expect(
    screen.getByRole("button", { name: "List" }).getAttribute("aria-pressed"),
  ).toBe("true");
  expect(document.cookie).toContain("library-view=list");
});

test("an empty journal says how to start", () => {
  render(<Library entries={[]} initialView="grid" />);
  expect(screen.getByText(/your library is empty/i)).toBeTruthy();
  expect(screen.queryByLabelText("Status")).toBeNull();
});
