// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Odometer } from "./odometer";

afterEach(cleanup);

const strips = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>("[aria-hidden] .flex-col"),
];

test("reads as plain text, with one rolling strip per digit", () => {
  const { container } = render(<Odometer text="2 months, 12 days" />);

  expect(screen.getByText("2 months, 12 days")).toBeTruthy();
  expect(strips(container).map((s) => s.style.transform)).toEqual([
    "translateY(-20%)",
    "translateY(-10%)",
    "translateY(-20%)",
  ]);
});

test("a number that changes keeps its digit and rolls it, even when the text gets shorter", () => {
  const { container, rerender } = render(<Odometer text="1 week, 2 days" />);
  const [, day] = strips(container);

  rerender(<Odometer text="1 week, 1 day" />);

  const [, dayAfter] = strips(container);
  expect(dayAfter).toBe(day);
  expect(dayAfter.style.transform).toBe("translateY(-10%)");
});
