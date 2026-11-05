import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import { AuthForm, type Submit } from "./auth-form";

const meta = {
  title: "Product/Auth form",
  component: AuthForm,
  args: {
    title: "Reset your password",
    submitLabel: "Send reset link",
    fields: [
      { name: "email", label: "Email", type: "email", autoComplete: "email" },
    ],
    onSubmit: fn<Submit>(async () => ({
      message:
        "If player@example.com has an account, a reset link is on its way.",
    })),
  },
  parameters: {
    docs: {
      description: {
        component:
          "Authentication form with retained non-password inputs, an unchanged action label while pending, a decorative spinner and a stable polite status region. Page confirmations use notice so they share the region and keep the form available. Catalog callbacks never contact the authentication service.",
      },
    },
  },
} satisfies Meta<typeof AuthForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Confirmed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Email" }),
      "player@example.com",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Send reset link" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "a reset link is on its way.",
    );
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument();
  },
};
export const Pending: Story = {
  beforeEach: ({ args }) => {
    let finish:
      | ((value: Awaited<ReturnType<typeof args.onSubmit>>) => void)
      | undefined;
    mocked(args.onSubmit).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    return () => finish?.(undefined);
  },
  args: { onSubmit: fn<Submit>(() => new Promise(() => {})) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Email" }),
      "player@example.com",
    );
    const button = canvas.getByRole("button", { name: "Send reset link" });
    button.focus();
    await userEvent.keyboard("{Enter}{Enter}");
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(args.onSubmit).toHaveBeenCalledOnce();
    await expect(canvas.getByRole("status")).toHaveTextContent("Submitting…");
  },
};

export const SignInAfterPasswordReset: Story = {
  args: {
    title: "Sign in",
    submitLabel: "Sign in with email",
    notice: "Password updated. Sign in with your new password.",
    fields: [
      { name: "email", label: "Email", type: "email", autoComplete: "email" },
      {
        name: "password",
        label: "Password",
        type: "password",
        autoComplete: "current-password",
      },
    ],
    onSubmit: fn<Submit>(async () => ({
      error: "Check your email and password and try again.",
    })),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByRole("status");
    await expect(status).toHaveTextContent(args.notice ?? "");
    await expect(status).toBeVisible();
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Email" }),
      "player@example.com",
    );
    await userEvent.type(canvas.getByLabelText("Password"), "wrong-password");
    await userEvent.click(
      canvas.getByRole("button", { name: "Sign in with email" }),
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Check your email and password and try again.",
    );
    await waitFor(() => expect(status).toHaveTextContent(args.notice ?? ""));
    await expect(canvas.getAllByRole("status")).toEqual([status]);
    await expect(canvas.getByRole("textbox", { name: "Email" })).toHaveValue(
      "player@example.com",
    );
  },
};
