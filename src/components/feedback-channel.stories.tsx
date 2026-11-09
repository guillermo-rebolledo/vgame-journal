import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  FeedbackChannel,
  FeedbackLink,
  FirstSaveFeedback,
  useFeedbackChannel,
} from "./feedback-channel";
import { Button } from "./ui/button";

function Saved() {
  const channel = useFeedbackChannel();
  return <Button onClick={() => channel?.saved()}>Save first game</Button>;
}
const meta = {
  title: "Product/Feedback entries",
  component: FeedbackChannel,
  args: {
    username: "catalog-player",
    onSubmit: fn(async () => undefined),
    children: null,
  },
  render: (args) => (
    <FeedbackChannel {...args}>
      <Saved />
      <FeedbackLink />
      <FirstSaveFeedback />
    </FeedbackChannel>
  ),
} satisfies Meta<typeof FeedbackChannel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const EmptyJournal: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const link = canvas.getByRole("button", {
      name: "Something confusing or missing?",
    });
    link.focus();
    await userEvent.keyboard("{Enter}");
    await expect(
      await body.findByRole("dialog", { name: "Send feedback" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(link).toHaveFocus());
  },
};
export const FirstSave: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Save first game" }),
    );
    await expect(
      await canvas.findByRole("complementary", { name: "First game feedback" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Dismiss invitation" }),
    );
    await expect(canvas.queryByRole("complementary")).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Something confusing or missing?" }),
    ).toBeVisible();
  },
};
