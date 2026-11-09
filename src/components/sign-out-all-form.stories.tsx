import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { SignOutAllForm } from "./sign-out-all-form";

const meta = {
  title: "Product/Sign out all devices",
  component: SignOutAllForm,
  args: {
    onSignOut: fn(async () => ({
      error: "Could not sign out all devices. Please try again.",
    })),
  },
  parameters: {
    docs: {
      description: {
        component:
          "Settings session action using Button, inline failure and retry; the production callback revokes sessions with Better Auth.",
      },
    },
  },
} satisfies Meta<typeof SignOutAllForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Retry: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Sign out all devices" }),
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Please try again",
    );
    await expect(
      canvas.getByRole("button", { name: "Sign out all devices" }),
    ).toBeEnabled();
  },
};
export const Pending: Story = {
  args: { onSignOut: fn(() => new Promise(() => {})) },
};
