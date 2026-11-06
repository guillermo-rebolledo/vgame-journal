// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { track } from "@vercel/analytics";
import { afterEach, expect, test, vi } from "vitest";
import { StarRating } from "./star-rating";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

type Save = (points: number | null) => Promise<{ error: string } | undefined>;

function renderRating(props: Partial<Parameters<typeof StarRating>[0]> = {}) {
  const onSave = vi.fn<Save>(async () => undefined);
  render(
    <StarRating
      value={null}
      editable
      gameTitle="Celeste"
      onSave={onSave}
      {...props}
    />,
  );
  return (props.onSave as typeof onSave | undefined) ?? onSave;
}

/** A save the test resolves by hand, to control response order. */
function deferred() {
  const calls: {
    points: number | null;
    resolve: (r?: { error: string }) => void;
  }[] = [];
  const onSave = vi.fn<Save>(
    (points) =>
      new Promise((resolve) =>
        calls.push({ points, resolve: resolve as never }),
      ),
  );
  return { onSave, calls };
}

const status = () => screen.getByRole("status");

test("offers ten half-star options in a group named Your rating", () => {
  renderRating();
  const group = screen.getByRole("group", { name: "Your rating" });
  expect(group).toBeTruthy();
  expect(screen.getAllByRole("radio")).toHaveLength(10);
  expect(
    screen.getByRole("radio", { name: "0.5 stars out of 5" }),
  ).toBeTruthy();
  expect(screen.getByRole("radio", { name: "1 star out of 5" })).toBeTruthy();
  expect(
    screen.getByRole("radio", { name: "3.5 stars out of 5" }),
  ).toBeTruthy();
  expect(screen.getByRole("radio", { name: "5 stars out of 5" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Clear rating" })).toBeNull();
});

test("choosing a Rating shows it at once, saves its points and announces it once", async () => {
  const user = userEvent.setup();
  const { onSave, calls } = deferred();
  renderRating({ onSave });
  await user.click(screen.getByRole("radio", { name: "3.5 stars out of 5" }));
  expect(
    (
      screen.getByRole("radio", {
        name: "3.5 stars out of 5",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  expect(onSave).toHaveBeenCalledExactlyOnceWith(7);
  expect(status().textContent).toBe("Saving Rating…");
  calls[0].resolve();
  await waitFor(() =>
    expect(status().textContent).toBe("Celeste: rated 3.5 stars out of 5."),
  );
  expect(track).toHaveBeenCalledExactlyOnceWith("rating_set", { points: 7 });
});

test("arrow keys move the choice and the last value chosen is the one saved", async () => {
  const user = userEvent.setup();
  const { onSave, calls } = deferred();
  renderRating({ value: 6, onSave });
  screen.getByRole("radio", { name: "3 stars out of 5" }).focus();
  await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
  expect(
    (
      screen.getByRole("radio", {
        name: "4.5 stars out of 5",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  // One save at a time: later choices wait and collapse to the latest.
  expect(onSave).toHaveBeenCalledExactlyOnceWith(7);
  calls[0].resolve();
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave).toHaveBeenLastCalledWith(9);
  // The earlier response never overwrote the later choice.
  expect(
    (
      screen.getByRole("radio", {
        name: "4.5 stars out of 5",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  calls[1].resolve();
  await waitFor(() =>
    expect(status().textContent).toBe("Celeste: rated 4.5 stars out of 5."),
  );
  expect(onSave).toHaveBeenCalledTimes(2);
});

test("a slower earlier save can't overwrite a later choice, even when it fails or refreshes late", async () => {
  const user = userEvent.setup();
  const { onSave, calls } = deferred();
  const props = { editable: true, gameTitle: "Celeste", onSave };
  const { rerender } = render(<StarRating value={6} {...props} />);
  const checked = () =>
    screen
      .getAllByRole("radio")
      .find((r) => (r as HTMLInputElement).checked)
      ?.getAttribute("aria-label");
  await user.click(screen.getByRole("radio", { name: "2 stars out of 5" }));
  await user.click(screen.getByRole("radio", { name: "4 stars out of 5" }));
  expect(checked()).toBe("4 stars out of 5");
  // The earlier save's refresh lands after the later choice was made.
  rerender(<StarRating value={4} {...props} />);
  expect(checked()).toBe("4 stars out of 5");
  // The earlier save then fails: no rollback or alert for a value no longer chosen.
  calls[0].resolve({ error: "Couldn’t save your Rating." });
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave).toHaveBeenLastCalledWith(8);
  expect(checked()).toBe("4 stars out of 5");
  expect(screen.queryByRole("alert")).toBeNull();
  calls[1].resolve();
  await waitFor(() =>
    expect(status().textContent).toBe("Celeste: rated 4 stars out of 5."),
  );
  expect(checked()).toBe("4 stars out of 5");
  expect(track).toHaveBeenCalledExactlyOnceWith("rating_set", { points: 8 });
});

test("a failed save restores the saved Rating, explains why and retries the chosen value", async () => {
  const user = userEvent.setup();
  const { onSave, calls } = deferred();
  renderRating({ value: 6, onSave });
  await user.click(screen.getByRole("radio", { name: "4 stars out of 5" }));
  calls[0].resolve({ error: "Mark it Played or Playing to rate it." });
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Mark it Played or Playing to rate it.",
  );
  expect(
    (
      screen.getByRole("radio", {
        name: "3 stars out of 5",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  expect(status().textContent).toBe("");
  expect(track).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Retry 4 stars" }));
  expect(onSave).toHaveBeenLastCalledWith(8);
  calls[1].resolve();
  await waitFor(() =>
    expect(status().textContent).toBe("Celeste: rated 4 stars out of 5."),
  );
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a save that throws shows a connection message, never the raw error", async () => {
  const user = userEvent.setup();
  renderRating({
    value: 6,
    onSave: vi.fn<Save>(async () => {
      throw new Error("ECONNRESET at db.ts:12");
    }),
  });
  await user.click(screen.getByRole("radio", { name: "4 stars out of 5" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Couldn’t save your Rating");
  expect(alert.textContent).not.toContain("ECONNRESET");
});

test("Clear rating removes the Rating and announces it", async () => {
  const user = userEvent.setup();
  const onSave = renderRating({ value: 7 });
  await user.click(screen.getByRole("button", { name: "Clear rating" }));
  expect(onSave).toHaveBeenCalledExactlyOnceWith(null);
  expect(
    screen.getAllByRole("radio").some((r) => (r as HTMLInputElement).checked),
  ).toBe(false);
  await waitFor(() =>
    expect(status().textContent).toBe("Celeste: Rating cleared."),
  );
  expect(track).toHaveBeenCalledExactlyOnceWith("rating_cleared", undefined);
});

test("a Rating kept outside Played or Playing is shown read-only with Clear rating and why", async () => {
  const user = userEvent.setup();
  const onSave = renderRating({ value: 9, editable: false });
  expect(screen.queryAllByRole("radio")).toHaveLength(0);
  expect(screen.getByText("Rated 4.5 out of 5")).toBeTruthy();
  expect(
    screen.getByText("Mark it Played or Playing to change your Rating."),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Clear rating" }));
  expect(onSave).toHaveBeenCalledExactlyOnceWith(null);
  await waitFor(() =>
    expect(status().textContent).toBe("Celeste: Rating cleared."),
  );
  expect(screen.queryByText(/Rated/)).toBeNull();
});

test("without a Rating, a game outside Played or Playing shows no control", () => {
  renderRating({ value: null, editable: false });
  expect(screen.queryByRole("group", { name: "Your rating" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Clear rating" })).toBeNull();
});

test("a disabled control can't be changed", () => {
  renderRating({ value: 4, disabled: true });
  for (const radio of screen.getAllByRole("radio"))
    expect((radio as HTMLInputElement).matches(":disabled")).toBe(true);
  expect(
    (screen.getByRole("button", { name: "Clear rating" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

test("a newly confirmed Rating from the server replaces the shown one", () => {
  const { rerender } = render(
    <StarRating value={4} editable gameTitle="Celeste" onSave={vi.fn()} />,
  );
  rerender(
    <StarRating value={10} editable gameTitle="Celeste" onSave={vi.fn()} />,
  );
  expect(
    (
      screen.getByRole("radio", {
        name: "5 stars out of 5",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
});
