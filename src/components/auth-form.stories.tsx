import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
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
          "Authentication form with retained non-password inputs, an unchanged action label while pending, a decorative spinner and a stable polite status region. Catalog callbacks never contact the authentication service.",
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
