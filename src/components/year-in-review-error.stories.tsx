import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import ReviewError from "@/app/year-in-review/error";

const meta = {
  title: "Product/Year in Review/Recovery",
  component: ReviewError,
  args: { error: new Error("Synthetic render failure"), reset: fn() },
} satisfies Meta<typeof ReviewError>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Retry: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", {
      name: "Retry review",
    });
    button.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.reset).toHaveBeenCalledOnce();
  },
};
