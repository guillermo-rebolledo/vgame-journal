// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PagedList } from "./paged-list";

const scroll = vi.fn();
beforeEach(() =>
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scroll,
  }),
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const items = Array.from({ length: 101 }, (_, index) => index + 1);
const list = (values: readonly number[]) => (
  <ol>
    {values.map((value) => (
      <li key={value}>{value}</li>
    ))}
  </ol>
);

test("pages through every item with bounded rows and keyboard focus at the new page", async () => {
  const user = userEvent.setup();
  render(
    <PagedList items={items} label="History">
      {list}
    </PagedList>,
  );
  const next = screen.getByRole("button", { name: "Next" });
  expect(screen.getAllByRole("listitem")).toHaveLength(48);
  expect(screen.getByRole("status").textContent).toBe("1–48 of 101");
  expect(
    screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled"),
  ).toBe(true);
  const seen = screen.getAllByRole("listitem").map((row) => row.textContent);
  for (const count of [48, 5]) {
    await user.click(next);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        count === 48 ? "49–96 of 101" : "97–101 of 101",
      ),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(count);
    expect(document.activeElement).toBe(
      screen.getByRole("group", { name: "History" }),
    );
    seen.push(...screen.getAllByRole("listitem").map((row) => row.textContent));
  }
  expect(seen).toEqual(items.map(String));
  expect(next.hasAttribute("disabled")).toBe(true);
  expect(scroll).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole("button", { name: "Previous" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("49–96 of 101"),
  );
  expect(
    within(screen.getByRole("list")).getAllByRole("listitem")[0].textContent,
  ).toBe("49");
});

test("shrinking data clamps the page and small lists omit paging controls", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <PagedList items={items} label="History">
      {list}
    </PagedList>,
  );
  await user.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("49–96 of 101"),
  );
  await user.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("97–101 of 101"),
  );
  rerender(
    <PagedList items={items.slice(0, 49)} label="History">
      {list}
    </PagedList>,
  );
  expect(screen.getByRole("status").textContent).toBe("49–49 of 49");
  rerender(
    <PagedList items={items.slice(0, 3)} label="History">
      {list}
    </PagedList>,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(screen.queryByRole("navigation")).toBeNull();
  rerender(
    <PagedList items={[]} label="History">
      {list}
    </PagedList>,
  );
  expect(screen.queryAllByRole("listitem")).toHaveLength(0);
});
