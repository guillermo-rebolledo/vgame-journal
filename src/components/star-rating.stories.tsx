import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { type SaveRating, StarRating } from "./star-rating";

const meta = {
  title: "Product/Star rating",
  component: StarRating,
  args: {
    value: null,
    editable: true,
    gameTitle: "Celeste",
    onSave: fn<SaveRating>(async () => undefined),
  },
  parameters: {
    docs: {
      description: {
        component:
          "The player's Rating input on the game page: a native radio group of ten half-star options (24 × 44px targets) drawn as five stars, plus Clear rating. Choices show at once, save one at a time so the last choice wins, and roll back with a retry on failure; confirmed saves are announced once. Outside Played or Playing a kept Rating is read-only and can only be cleared. Closest existing components: JournalStatus (single Status choice) and Fact (static value). Callbacks here are local test doubles. Source: src/components/star-rating.tsx.",
      },
    },
  },
} satisfies Meta<typeof StarRating>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("radio", { name: "3.5 stars out of 5" }),
    );
    await waitFor(() => expect(args.onSave).toHaveBeenCalledWith(7));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Celeste: rated 3.5 stars out of 5.",
    );
  },
};
export const Rated: Story = { args: { value: 8 } };
export const RatedLight: Story = { ...Rated, globals: { theme: "light" } };
export const HalfValue: Story = { args: { value: 5 } };

export const KeyboardAndClear: Story = {
  args: { value: 6 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(
      canvas.getByRole("radio", { name: "3 stars out of 5" }),
    ).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(args.onSave).toHaveBeenLastCalledWith(7));
    await userEvent.click(canvas.getByRole("button", { name: "Clear rating" }));
    await waitFor(() => expect(args.onSave).toHaveBeenLastCalledWith(null));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Celeste: Rating cleared.",
    );
  },
};

export const Pending: Story = {
  args: {
    value: 6,
    onSave: fn<SaveRating>(() => new Promise(() => {})),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("radio", { name: "4 stars out of 5" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Saving Rating…",
    );
    await expect(
      canvas.getByRole("radio", { name: "4 stars out of 5" }),
    ).toBeChecked();
  },
};

let failures = 0;
export const FailedThenRetry: Story = {
  beforeEach: () => {
    failures = 0;
  },
  args: {
    value: 6,
    // Fails the first save, then saves.
    onSave: fn<SaveRating>(async () => {
      return failures++ === 0
        ? {
            error:
              "Couldn’t save your Rating. Check your connection and try again.",
          }
        : undefined;
    }),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("radio", { name: "4 stars out of 5" }),
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Couldn’t save your Rating",
    );
    // Rolled back to the saved Rating.
    await expect(
      canvas.getByRole("radio", { name: "3 stars out of 5" }),
    ).toBeChecked();
    await userEvent.click(
      canvas.getByRole("button", { name: "Retry 4 stars" }),
    );
    await waitFor(() => expect(args.onSave).toHaveBeenCalledTimes(2));
    await expect(args.onSave).toHaveBeenLastCalledWith(8);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Celeste: rated 4 stars out of 5.",
    );
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  args: { value: 9, editable: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Rated 4.5 out of 5")).toBeVisible();
    await expect(
      canvas.getByText("Mark it Played or Playing to change your Rating."),
    ).toBeVisible();
  },
};

export const Disabled: Story = { args: { value: 4, disabled: true } };
