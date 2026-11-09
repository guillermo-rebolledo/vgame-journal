import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { SupportLink } from "./support-link";

const meta = {
  title: "Product/Support link",
  component: SupportLink,
  parameters: {
    docs: {
      description: {
        component:
          "Public email contact for authentication screens and the footer. Works before account setup and includes no page or account context; use Feedback for signed-in reports.",
      },
    },
  },
} satisfies Meta<typeof SupportLink>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PublicContact: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", {
      name: "Contact support",
    });
    await userEvent.tab();
    await expect(link).toHaveFocus();
    await expect(link).toHaveAttribute(
      "href",
      "mailto:memorebo.dev@gmail.com?subject=Help%20with%20shelve.games",
    );
  },
};
