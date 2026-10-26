// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Stats } from "./stats";

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
