// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Stats } from "./stats";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

const noRatings = {
  count: 0,
  average: null,
  distribution: Array<number>(10).fill(0),
};

test("empty stats explain how to start each chart", () => {
  render(
    <Stats
      stats={{
        finishedPerYear: [],
        hoursByPlatform: [],
        backlogOverTime: [],
        ratings: noRatings,
      }}
    />,
  );
  expect(screen.getByText(/No finished games yet/)).toBeTruthy();
  expect(screen.getByText(/No hours logged yet/)).toBeTruthy();
  expect(screen.getByText(/No status history yet/)).toBeTruthy();
  expect(screen.getByText(/No Ratings yet. Rate a game/)).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Go to Library" })).toHaveLength(
    4,
  );
});

const empty = { finishedPerYear: [], hoursByPlatform: [], backlogOverTime: [] };

test("Your ratings shows the average, count and every half star as text", () => {
  render(
    <Stats
      stats={{
        ...empty,
        // One 3-star, two 4-star and one 4.5-star Rating.
        ratings: {
          count: 4,
          average: 3.9,
          distribution: [0, 0, 0, 0, 0, 1, 0, 2, 1, 0],
        },
      }}
    />,
  );
  const section = screen.getByRole("region", { name: "Your ratings" });
  expect(within(section).getByText("Average 3.9 out of 5")).toBeTruthy();
  expect(within(section).getByText("4 rated games")).toBeTruthy();
  const rows = within(
    within(section).getByRole("list", { name: "Rated games by Rating" }),
  )
    .getAllByRole("listitem")
    .map((row) => row.textContent);
  expect(rows).toHaveLength(10);
  expect(rows.slice(0, 4)).toEqual([
    "5 stars0 games",
    "4.5 stars1 game",
    "4 stars2 games",
    "3.5 stars0 games",
  ]);
  expect(rows.at(-1)).toBe("0.5 stars0 games");
});

test("a whole-star average keeps one decimal, and a single Rating reads in the singular", () => {
  render(
    <Stats
      stats={{
        ...empty,
        ratings: {
          count: 1,
          average: 4,
          distribution: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
        },
      }}
    />,
  );
  expect(screen.getByText("Average 4.0 out of 5")).toBeTruthy();
  expect(screen.getByText("1 rated game")).toBeTruthy();
});

test("public Stats name the section Ratings and drop the owner's instructions", () => {
  render(<Stats stats={{ ...empty, ratings: noRatings }} readOnly />);
  const section = screen.getByRole("region", { name: "Ratings" });
  expect(section.textContent).toContain("No Ratings yet.");
  expect(section.textContent).not.toContain("Rate a game");
});

test("zero values and a single backlog day render with exact accessible values", () => {
  const { container } = render(
    <Stats
      stats={{
        finishedPerYear: [{ year: 2026, games: 2 }],
        hoursByPlatform: [{ platform: "Nintendo Switch", hours: 0 }],
        backlogOverTime: [{ day: "2026-01-01", games: 0 }],
        ratings: noRatings,
      }}
    />,
  );
  expect(screen.getByText("2 games")).toBeTruthy();
  expect(screen.getByText("0 hours")).toBeTruthy();
  expect(
    screen.getByRole("img", { name: /Backlog size over time/ }),
  ).toBeTruthy();
  expect(screen.getByText("View backlog data")).toBeTruthy();
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
});

test("large backlog histories keep exact chart data without mounting hidden table rows", async () => {
  const { default: userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  const points = Array.from({ length: 1000 }, (_, i) => ({
    day: new Date(Date.UTC(2020, 0, i + 1)).toISOString().slice(0, 10),
    games: i % 100,
  }));
  const { container } = render(
    <Stats
      stats={{
        finishedPerYear: [],
        hoursByPlatform: [],
        backlogOverTime: points,
        ratings: noRatings,
      }}
    />,
  );
  expect(container.querySelectorAll("svg circle")).toHaveLength(0);
  expect(
    container.querySelector("svg path")?.getAttribute("d")?.match(/[HM]/g),
  ).toHaveLength(1000);
  expect(screen.queryByRole("table")).toBeNull();
  await user.click(screen.getByText("View backlog data"));
  expect(await screen.findByRole("table")).toBeTruthy();
  expect(screen.getAllByRole("row")).toHaveLength(49);
});

test("Stats nouns agree with the formatted value at the rounding boundary", () => {
  render(
    <Stats
      stats={{
        finishedPerYear: [],
        hoursByPlatform: [
          { platform: "PC", hours: 1.004 },
          { platform: "Nintendo Switch", hours: 1.006 },
        ],
        backlogOverTime: [],
        ratings: noRatings,
      }}
    />,
  );
  expect(screen.getByText("1 hour")).toBeTruthy();
  expect(screen.getByText("1.01 hours")).toBeTruthy();
});
