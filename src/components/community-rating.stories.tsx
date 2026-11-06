import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  CommunityRatingFact,
  CommunityRatingSkeleton,
  CommunityRatingUnavailable,
} from "./community-rating";

const meta = {
  title: "Product/Community rating",
  component: CommunityRatingFact,
  args: {
    summary: {
      count: 128,
      average: 4.2,
      distribution: [1, 0, 2, 3, 6, 9, 18, 30, 25, 34],
    },
  },
  decorators: [
    (Story) => (
      <dl className="@container grid max-w-md gap-4">
        <Story />
      </dl>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The Community rating card in GameFactsGrid's communityRating slot: the average out of 5, the number of Ratings and a ten-bar distribution with its exact values in View rating data. Below the threshold it shows only how many Ratings so far. The game page streams it in its own Suspense and error boundary (CommunityRatingBoundary). Source: src/components/community-rating.tsx.",
      },
    },
  },
} satisfies Meta<typeof CommunityRatingFact>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("4.2")).toBeVisible();
    await expect(canvas.getByText("128 Ratings")).toBeVisible();
    await userEvent.click(canvas.getByText("View rating data"));
    await expect(canvas.getByRole("row", { name: "5 stars 34" })).toBeVisible();
  },
};
export const PopulatedLight: Story = {
  ...Populated,
  globals: { theme: "light" },
};
export const BelowThreshold: Story = {
  args: {
    summary: {
      count: 3,
      average: null,
      distribution: [0, 0, 0, 0, 0, 1, 1, 0, 0, 1],
    },
  },
};
export const Empty: Story = {
  args: {
    summary: { count: 0, average: null, distribution: Array(10).fill(0) },
  },
};
export const Loading: Story = { render: () => <CommunityRatingSkeleton /> };
export const Unavailable: Story = {
  render: () => <CommunityRatingUnavailable retry={fn()} />,
};
