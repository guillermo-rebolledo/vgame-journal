import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { ReviewInvitation } from "./review-invitation";

const meta = {
  title: "Product/Review Invitation",
  component: ReviewInvitation,
  args: {
    year: 2026,
    viewed: false,
    onDismiss: fn(async (): Promise<string | null> => null),
  },
  beforeEach: ({ args }) => {
    mocked(args.onDismiss).mockReset().mockResolvedValue(null);
  },
  parameters: {
    docs: {
      description: {
        component:
          "Home's flag-gated Year in Review promotion: a ruled Keepsake bento in Geist Mono, composed from Button and Link. A recorded visit reveals session dismissal and a year-scoped account preference. Hiding waits for the server to confirm the save; failures retain the banner and can be retried. Session dismissal lasts for the current sign-in, across tabs. No browser storage or credentials are exposed.",
      },
    },
  },
  render: (args) => (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <h1 id="home-journal-heading" tabIndex={-1}>
        Your Journal
      </h1>
      <ReviewInvitation {...args} />
    </div>
  ),
} satisfies Meta<typeof ReviewInvitation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const New: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: /View/ })).toHaveAttribute(
      "href",
      "/year-in-review",
    );
    await expect(canvas.queryByRole("button", { name: "Dismiss" })).toBeNull();
  },
};
export const Viewed: Story = { args: { viewed: true } };
export const LightTheme: Story = {
  args: { viewed: true },
  globals: { theme: "light" },
};
export const SessionDismiss: Story = {
  args: { viewed: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("button", { name: "Dismiss" }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onDismiss).toHaveBeenCalledWith("session");
    await expect(canvas.queryByRole("region")).toBeNull();
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveFocus();
  },
};
export const FailureAndRetry: Story = {
  args: { viewed: true },
  beforeEach: ({ args }) => {
    mocked(args.onDismiss)
      .mockResolvedValueOnce("Couldn’t save your choice. Please try again.")
      .mockResolvedValue(null);
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Don’t show again" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Couldn’t save your choice",
    );
    await expect(canvas.getByRole("link", { name: /View/ })).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Don’t show again" }),
    );
    await expect(args.onDismiss).toHaveBeenLastCalledWith("year");
    await expect(canvas.queryByRole("region")).toBeNull();
  },
};
export const Pending: Story = {
  args: { viewed: true },
  beforeEach: ({ args }) => {
    mocked(args.onDismiss).mockImplementation(() => new Promise(() => {}));
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss" }));
    await expect(
      canvas.getByRole("button", { name: "Dismiss" }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: "Don’t show again" }),
    ).toBeDisabled();
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Saving your choice",
    );
    await expect(
      canvas.getByRole("status").querySelector(".shimmer"),
    ).toBeVisible();
    await expect(
      canvas
        .getByRole("status")
        .querySelector('[data-active="true"] [data-slot="spinner"]'),
    ).toHaveAttribute("aria-hidden", "true");
  },
};
