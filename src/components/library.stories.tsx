import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { Library } from "./library";

const meta = {
  title: "Product/Library",
  component: Library,
  parameters: {
    docs: {
      description: {
        component:
          "Library keeps title and Status visible, with advanced filters and ordering in a disclosure. The owner page heading supplies the Steam import action.",
      },
    },
  },
  args: { entries: [], initialView: "grid" },
} satisfies Meta<typeof Library>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: "Find a game" }),
    ).toBeVisible();
  },
};
export const PublicEmpty: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("No games in this library yet."),
    ).toBeVisible();
  },
};
export const CompactFilters: Story = {
  args: {
    entries: [
      {
        gameId: 1,
        title: "Celeste",
        slug: "celeste",
        coverImageId: null,
        status: "backlog",
        completionTag: null,
        rating: null,
        releasedAt: new Date("2018-01-25"),
        addedAt: new Date("2026-02-01"),
        platforms: ["PC"],
        years: [],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByText("Filters and sort");
    await expect(canvas.getByLabelText("Sort by")).not.toBeVisible();
    await userEvent.click(toggle);
    await expect(canvas.getByLabelText("Sort by")).toBeVisible();
    await expect(canvas.getByLabelText("Platform")).toBeVisible();
    await userEvent.click(toggle);
    await expect(canvas.getByLabelText("Sort by")).not.toBeVisible();
  },
};
export const Light: Story = { ...CompactFilters, globals: { theme: "light" } };
