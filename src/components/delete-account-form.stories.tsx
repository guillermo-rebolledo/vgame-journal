import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
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
    onSendCode: fn(
      async (): Promise<{ sent?: true; error?: string }> => ({ sent: true }),
    ),
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
export const EmailConfirmation: Story = {
  args: {
    hasPassword: false,
    hasGoogle: true,
    onVerify: fn(async () => ({
      error: "Could not confirm the code. Request a new code or try again.",
    })),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Send confirmation code" }),
    );
    await expect(
      canvas.getByLabelText("Email confirmation code"),
    ).toHaveFocus();
    await userEvent.type(
      canvas.getByLabelText("Email confirmation code"),
      "12345678",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Confirm email code" }),
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Could not confirm the code",
    );
    await expect(args.onDelete).not.toHaveBeenCalled();
    await userEvent.click(
      canvas.getByRole("button", { name: "Cancel deletion" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Send confirmation code" }),
    ).toHaveFocus();
  },
};
export const SendingCode: Story = {
  beforeEach: ({ args }) => {
    let finish: ((value: { sent?: true; error?: string }) => void) | undefined;
    mocked(args.onSendCode).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    return () => finish?.({});
  },
  args: {
    hasPassword: false,
    hasGoogle: true,
    onSendCode: fn(() => new Promise(() => {})),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Send confirmation code" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Send confirmation code" }),
    ).toBeDisabled();
    await expect(canvas.getAllByRole("status")).toHaveLength(1);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Sending confirmation code…",
    );
    await expect(
      canvas.getByRole("status").querySelector(".shimmer"),
    ).toHaveTextContent("Sending confirmation code…");
    await expect(
      canvas
        .getByRole("status")
        .querySelector('[data-active="true"] [data-slot="spinner"]'),
    ).toHaveAttribute("aria-hidden", "true");
  },
};
export const EmailDeliveryRetry: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onSendCode)
      .mockReset()
      .mockResolvedValueOnce({
        error: "Could not send confirmation. Please try again.",
      })
      .mockResolvedValue({ sent: true });
  },
  args: {
    hasPassword: false,
    hasGoogle: true,
    onSendCode: fn(
      async (): Promise<{ error?: string; sent?: true }> => ({
        error: "Could not send confirmation. Please try again.",
      }),
    )
      .mockResolvedValueOnce({
        error: "Could not send confirmation. Please try again.",
      })
      .mockResolvedValueOnce({ sent: true }),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Send confirmation code" }),
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Could not send confirmation",
    );
    await expect(
      canvas.queryByLabelText("Type DELETE to confirm"),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Send confirmation code" }),
    );
    await expect(
      canvas.getByLabelText("Email confirmation code"),
    ).toHaveFocus();
    await expect(args.onDelete).not.toHaveBeenCalled();
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
    await expect(canvas.getAllByRole("status")).toHaveLength(1);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Confirming identity…",
    );
  },
};

export const Deleting: Story = {
  args: { verified: true, onDelete: fn(() => new Promise(() => {})) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText("Type DELETE to confirm"),
      "DELETE",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Permanently delete account" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Permanently delete account" }),
    ).toBeDisabled();
    await expect(canvas.getAllByRole("status")).toHaveLength(1);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Deleting account…",
    );
  },
};
export const Cancelling: Story = {
  args: { verified: true, onCancel: fn(() => new Promise(() => {})) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Cancel deletion" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Cancel deletion" }),
    ).toBeDisabled();
    await expect(canvas.getAllByRole("status")).toHaveLength(1);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Cancelling deletion…",
    );
  },
};
