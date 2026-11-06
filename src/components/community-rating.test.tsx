// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import {
  CommunityRatingFact,
  CommunityRatingUnavailable,
} from "./community-rating";

afterEach(cleanup);

const facts = (ui: React.ReactNode) => render(<dl>{ui}</dl>);
const card = () =>
  screen.getByText("Community rating").parentElement as HTMLElement;

test("with enough Ratings it shows the average out of 5, the count and the distribution as text", () => {
  facts(
    <CommunityRatingFact
      summary={{
        count: 12,
        average: 4.2,
        distribution: [0, 0, 0, 1, 0, 1, 2, 3, 0, 5],
      }}
    />,
  );
  const fact = within(card());
  expect(fact.getByText("4.2")).toBeTruthy();
  expect(fact.getByText("out of 5")).toBeTruthy();
  expect(fact.getByText("12 Ratings")).toBeTruthy();
  expect(
    fact.getByRole("img", { name: /Distribution of Ratings/ }),
  ).toBeTruthy();
  expect(fact.getByText("View rating data")).toBeTruthy();
  const rows = fact.getAllByRole("row").map((row) => row.textContent);
  expect(rows).toContain("5 stars5");
  expect(rows).toContain("2 stars1");
  expect(rows).toContain("0.5 stars0");
});

test("below the threshold it shows only how many Ratings there are so far", () => {
  facts(
    <CommunityRatingFact
      summary={{
        count: 3,
        average: null,
        distribution: [0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
      }}
    />,
  );
  const fact = within(card());
  expect(fact.getByText("3 Ratings so far")).toBeTruthy();
  expect(fact.queryByText("out of 5")).toBeNull();
  expect(fact.queryByText("View rating data")).toBeNull();
});

test("one Rating reads in the singular", () => {
  facts(
    <CommunityRatingFact
      summary={{
        count: 1,
        average: null,
        distribution: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      }}
    />,
  );
  expect(screen.getByText("1 Rating so far")).toBeTruthy();
});

test("with no Ratings it says so", () => {
  facts(
    <CommunityRatingFact
      summary={{ count: 0, average: null, distribution: Array(10).fill(0) }}
    />,
  );
  expect(within(card()).getByText("No ratings yet")).toBeTruthy();
});

test("a failed read shows the Community rating as unavailable", () => {
  facts(<CommunityRatingUnavailable />);
  expect(within(card()).getByText("Community rating unavailable")).toBeTruthy();
});
