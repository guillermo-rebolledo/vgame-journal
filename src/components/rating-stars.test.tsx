// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { RatingStars } from "./rating-stars";

afterEach(cleanup);

test.each([
  [1, "Rated 0.5 out of 5"],
  [2, "Rated 1 out of 5"],
  [9, "Rated 4.5 out of 5"],
  [10, "Rated 5 out of 5"],
])("%i rating points read as stars out of 5", (points, text) => {
  const { container } = render(<RatingStars points={points} />);
  expect(container.textContent).toBe(text);
});
