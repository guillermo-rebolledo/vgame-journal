// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Stats } from "./stats";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

test("empty stats explain how to start each chart", () => {
  render(
    <Stats
      stats={{ finishedPerYear: [], hoursByPlatform: [], backlogOverTime: [] }}
    />,
  );
  expect(screen.getByText(/No finished games yet/)).toBeTruthy();
  expect(screen.getByText(/No hours logged yet/)).toBeTruthy();
  expect(screen.getByText(/No status history yet/)).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Go to Library" })).toHaveLength(
    3,
  );
});

test("zero values and a single backlog day render with exact accessible values", () => {
  const { container } = render(
    <Stats
      stats={{
        finishedPerYear: [{ year: 2026, games: 2 }],
        hoursByPlatform: [{ platform: "Nintendo Switch", hours: 0 }],
        backlogOverTime: [{ day: "2026-01-01", games: 0 }],
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
      }}
    />,
  );
  expect(screen.getByText("1 hour")).toBeTruthy();
  expect(screen.getByText("1.01 hours")).toBeTruthy();
});
