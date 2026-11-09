import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { AccountMenu } from "./account-menu";
import type { SubmitFeedback } from "./feedback";

const meta = {
  title: "Product/Account menu",
  component: AccountMenu,
  args: {
    user: { username: "catalog-player", name: "Catalog player" },
    onSubmitFeedback: fn<SubmitFeedback>(async () => undefined),
  },
  parameters: {
    docs: {
      description: {
        component:
          "Account navigation with Theme and Feedback. Feedback reuses the existing drawer outside the menu popup and returns focus to the account trigger on dismissal. All submissions use local callbacks.",
      },
    },
  },
} satisfies Meta<typeof AccountMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FeedbackFromMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: /Account menu/ });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const feedback = await body.findByRole("menuitem", {
      name: "Feedback",
    });
    feedback.focus();
    await userEvent.keyboard("{Enter}");
    await expect(
      await body.findByRole("dialog", { name: "Send feedback" }),
    ).toBeVisible();
    await expect(body.queryByRole("menu")).not.toBeInTheDocument();
    await expect(
      body.getByText(/private to the team and relevant processors/),
    ).toBeVisible();
    await userEvent.type(
      body.getByRole("textbox", { name: "Message" }),
      "Please add shelves.",
    );
    await userEvent.click(body.getByRole("button", { name: "Send" }));
    await expect(
      await body.findByRole("heading", { name: "Thanks, got it." }),
    ).toBeVisible();
    await userEvent.click(body.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    await userEvent.click(
      await body.findByRole("menuitem", { name: "Feedback" }),
    );
    await expect(body.getByRole("textbox", { name: "Message" })).toHaveValue(
      "",
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
export const Guest: Story = { args: { user: null } };
export const NeedsUsername: Story = { args: { user: { name: "New player" } } };
