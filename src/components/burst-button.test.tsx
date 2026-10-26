// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { BurstButton } from "./burst-button";

afterEach(cleanup);

test("pressing the button sets off a burst that screen readers skip", async () => {
  render(<BurstButton type="button">Completed</BurstButton>);
  const button = screen.getByRole("button", { name: "Completed" });
  expect(button.querySelector("[data-burst]")).toBeNull();

  await userEvent.click(button);

  const burst = button.querySelector("[data-burst]");
  expect(burst?.getAttribute("aria-hidden")).toBe("true");
  expect(burst?.children.length).toBeGreaterThan(0);
  expect(button.textContent).toBe("Completed");
});

test("switching it off again is no occasion for a burst", async () => {
  render(
    <BurstButton type="button" aria-pressed>
      Completed
    </BurstButton>,
  );
  const button = screen.getByRole("button", { name: "Completed" });

  await userEvent.click(button);

  expect(button.querySelector("[data-burst]")).toBeNull();
});
