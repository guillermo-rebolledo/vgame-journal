import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DeleteAccountForm } from "./delete-account-form";

const meta = {
  title: "Product/Delete account",
  component: DeleteAccountForm,
  args: {
    verified: false,
    hasPassword: true,
    hasGoogle: false,
    onDelete: fn(async () => ({
      error: "Confirmation expired. Confirm your identity again.",
    })),
    onVerify: fn(async () => ({
      error:
        "Could not confirm your password. Try again or reset your password.",
    })),
    onCancel: fn(async () => ({})),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Settings deletion flow using existing Button, Input and Label. Authentication precedes typed DELETE. Server callbacks enforce proof validity; stories use local callbacks only.",
      },
    },
  },
} satisfies Meta<typeof DeleteAccountForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PasswordRetry: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByLabelText("Type DELETE to confirm"),
    ).not.toBeInTheDocument();
    await userEvent.type(
      canvas.getByLabelText("Current password"),
      "incorrect",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Confirm password" }),
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Could not confirm your password",
    );
    await expect(args.onDelete).not.toHaveBeenCalled();
    await expect(
      canvas.getByRole("button", { name: "Confirm password" }),
    ).toBeEnabled();
  },
};
export const FinalConfirmation: Story = {
  args: { verified: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", {
      name: "Permanently delete account",
    });
    await expect(button).toBeDisabled();
    await userEvent.type(
      canvas.getByLabelText("Type DELETE to confirm"),
      "DELETE",
    );
    await expect(button).toBeEnabled();
    await userEvent.click(
      canvas.getByRole("button", { name: "Cancel deletion" }),
    );
    await expect(args.onCancel).toHaveBeenCalledOnce();
    await expect(args.onDelete).not.toHaveBeenCalled();
    await expect(canvas.getByLabelText("Type DELETE to confirm")).toHaveValue(
      "",
    );
  },
};
export const GoogleCancelled: Story = {
  args: {
    hasPassword: false,
    hasGoogle: true,
    notice:
      "Google confirmation was cancelled or failed. Your account has not been deleted. Try again.",
  },
};
export const Pending: Story = {
  args: { onVerify: fn(() => new Promise(() => {})) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText("Current password"),
      "password123",
    );
    const button = canvas.getByRole("button", { name: "Confirm password" });
    button.focus();
    await userEvent.keyboard("{Enter}{Enter}");
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
  },
};
