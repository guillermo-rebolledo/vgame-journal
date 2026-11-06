import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { RatingStars } from "./rating-stars";

const meta = {
  title: "Product/RatingStars",
  component: RatingStars,
  args: { points: 9 },
  parameters: {
    docs: {
      description: {
        component:
          "Read-only display of a Rating: rating points 1–10 drawn as half a star to 5 stars, with the exact value as screen-reader text. Sized by the surrounding font size. Use on Library cards and rows and in Stats; for choosing a Rating use the star rating input. Source: src/components/rating-stars.tsx.",
      },
    },
  },
} satisfies Meta<typeof RatingStars>;
export default meta;
type Story = StoryObj<typeof meta>;

export const HalfStar: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Rated 4.5 out of 5"),
    ).toBeInTheDocument();
  },
};
export const WholeStars: Story = { args: { points: 6 } };
export const Lowest: Story = {
  args: { points: 1 },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Rated 0.5 out of 5"),
    ).toBeInTheDocument();
  },
};
export const Highest: Story = { args: { points: 10 } };
export const TypographySizes: Story = {
  render: (args) => (
    <div className="grid gap-4">
      {["text-xs", "text-sm", "text-xl"].map((size) => (
        <p key={size} className={size}>
          <RatingStars {...args} />
        </p>
      ))}
    </div>
  ),
};
