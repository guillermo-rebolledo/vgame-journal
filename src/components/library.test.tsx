// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import type { LibraryEntry } from "@/lib/library";
import { Library } from "./library";

// The real hook follows history.replaceState; this one reads the same URL.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/library");
});

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
  await waitFor(() =>
    expect(titles()).toEqual(["Hollow Knight", "Celeste", "Elden Ring"]),
  );

  await user.selectOptions(screen.getByLabelText("Status"), "Played");
  await waitFor(() => expect(titles()).toEqual(["Hollow Knight", "Celeste"]));

  await user.selectOptions(screen.getByLabelText("Sort by"), "Title (A–Z)");
  await waitFor(() => expect(titles()).toEqual(["Celeste", "Hollow Knight"]));

  await user.click(screen.getByText("More filters"));
  await user.selectOptions(screen.getByLabelText("Platform"), "PC");
  await waitFor(() => expect(titles()).toEqual(["Celeste"]));

  await user.selectOptions(screen.getByLabelText("Status"), "All statuses");
  await user.selectOptions(screen.getByLabelText("Year played"), "2025");
  await waitFor(() => expect(titles()).toEqual(["Elden Ring"]));

  await user.selectOptions(
    screen.getByLabelText("Platform"),
    "Nintendo Switch",
  );
  await waitFor(() =>
    expect(screen.queryByRole("list", { name: "Games" })).toBeNull(),
  );
  expect(screen.getByText(/no games match/i)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /clear filters/i }));
  await waitFor(() =>
    expect(titles()).toEqual(["Celeste", "Elden Ring", "Hollow Knight"]),
  );
});

test("a title search combines with filters, ignoring case and accents", async () => {
  const user = userEvent.setup();
  render(
    <Library
      entries={[...entries, entry({ gameId: 4, title: "Pokémon Emerald" })]}
      initialView="grid"
    />,
  );

  await user.type(screen.getByLabelText("Search your Library"), "POKEMON");
  await waitFor(() => expect(titles()).toEqual(["Pokémon Emerald"]));

  await user.clear(screen.getByLabelText("Search your Library"));
  await user.type(screen.getByLabelText("Search your Library"), "l");
  await user.selectOptions(screen.getByLabelText("Status"), "Played");
  await waitFor(() => expect(titles()).toEqual(["Hollow Knight", "Celeste"]));
  expect(screen.getByText("2 of 4 games")).toBeTruthy();
});

test("search, filters and sort live in the URL, so reloads and Back restore them", async () => {
  window.history.replaceState(
    null,
    "",
    "/library?q=l&status=played&sort=title&platform=Bogus",
  );
  const user = userEvent.setup();
  render(<Library entries={entries} initialView="grid" />);

  await waitFor(() => expect(titles()).toEqual(["Celeste", "Hollow Knight"]));
  expect(
    (screen.getByLabelText("Search your Library") as HTMLInputElement).value,
  ).toBe("l");

  await user.selectOptions(screen.getByLabelText("Sort by"), "Recently added");
  await user.selectOptions(screen.getByLabelText("Status"), "Playing");
  // A platform none of the games has is dropped rather than hiding everything.
  expect(window.location.search).toBe("?q=l&status=playing");
});

test("Clear filters is offered whenever a filter is on, and keeps sort and view", async () => {
  const user = userEvent.setup();
  render(<Library entries={entries} initialView="grid" />);
  expect(screen.queryByRole("button", { name: /clear filters/i })).toBeNull();

  await user.click(screen.getByRole("button", { name: "List" }));
  await user.selectOptions(screen.getByLabelText("Sort by"), "Title (A–Z)");
  await user.selectOptions(screen.getByLabelText("Status"), "Played");
  expect(await screen.findByText("2 of 3 games")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: /clear filters/i }));
  await waitFor(() =>
    expect(titles()).toEqual(["Celeste", "Elden Ring", "Hollow Knight"]),
  );
  expect(window.location.search).toBe("?sort=title");
  expect(
    screen.getByRole("button", { name: "List" }).getAttribute("aria-pressed"),
  ).toBe("true");
});

test("platform and year filters wait behind More filters, open when one is set", () => {
  window.history.replaceState(null, "", "/library?year=2024");
  render(<Library entries={entries} initialView="grid" />);
  const more = screen.getByText("More filters").closest("details");
  expect(more?.open).toBe(true);
  expect(titles()).toEqual(["Celeste", "Elden Ring"]);
});

test("sort choices say which way they go", () => {
  render(<Library entries={entries} initialView="grid" />);
  expect(
    within(screen.getByLabelText("Sort by"))
      .getAllByRole("option")
      .map((o) => o.textContent),
  ).toEqual(["Recently added", "Release date (newest first)", "Title (A–Z)"]);
});

test("grid and list both show Status, platforms and release year", async () => {
  const user = userEvent.setup();
  const games = [
    entry({
      gameId: 1,
      title: "Celeste",
      status: "played",
      completionTag: "completed",
      platforms: ["PC", "Nintendo Switch"],
      releasedAt: new Date("2018-01-25"),
    }),
  ];
  render(<Library entries={games} initialView="grid" />);
  const card = () =>
    within(screen.getByRole("list", { name: "Games" })).getByRole("link")
      .textContent;
  for (const view of ["Grid", "List"]) {
    await user.click(screen.getByRole("button", { name: view }));
    expect(card()).toContain("Played · Completed");
    expect(card()).toContain("PC, Nintendo Switch");
    expect(card()).toContain("2018");
  }
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

test("large libraries page in either view and search the entire collection", async () => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  const user = userEvent.setup();
  render(
    <Library
      entries={Array.from({ length: 120 }, (_, i) =>
        entry({
          gameId: i + 1,
          title: `Game ${String(i + 1).padStart(3, "0")}`,
        }),
      )}
      initialView="grid"
    />,
  );
  await waitFor(() => expect(titles()).toHaveLength(48));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(titles()[0]).toBe("Game 049"));
  await user.click(screen.getByRole("button", { name: "List" }));
  await waitFor(() => expect(titles()).toHaveLength(48));
  await waitFor(() => expect(titles()[0]).toBe("Game 049"));
  await user.type(screen.getByRole("searchbox"), "120");
  await waitFor(() => expect(titles()).toEqual(["Game 120"]));
  expect(screen.getByText("1 of 120 games")).toBeTruthy();
  await user.clear(screen.getByRole("searchbox"));
  await waitFor(() => expect(titles()[0]).toBe("Game 001"));
});
