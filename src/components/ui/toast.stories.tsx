import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import { Toaster, toast } from "./toast";

const meta = {
  title: "UI/Toast",
  component: Toaster,
  beforeEach: () => () => toast.close(),
  parameters: {
    docs: {
      description: {
        component:
          "Base UI notifications hosted once at the app root (also by the catalog preview). Use after a completed action dismisses its editor; keep focus on the restored trigger. Low priority is polite. Errors and notifications containing recovery actions use timeout: 0 and a dismiss button. Field and retry guidance stays in its form. Neutral success, Ember errors, 200ms entrance / 140ms exit, opacity only with reduced motion.",
      },
    },
  },
  render: () => (
    <Button
      onClick={() =>
        toast.add({
          title: "Playthrough saved",
          description: "Celeste · PC",
          type: "success",
        })
      }
    >
      Save playthrough
    </Button>
  ),
} satisfies Meta<typeof Toaster>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Success: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Save playthrough" });
    await userEvent.click(trigger);
    const notification = await body.findByRole("dialog", {
      name: "Playthrough saved",
    });
    await expect(notification).toHaveAttribute("aria-modal", "false");
    await expect(trigger).toHaveFocus();
    await userEvent.click(
      within(notification).getByRole("button", {
        name: "Dismiss notification",
      }),
    );
    await waitFor(() =>
      expect(
        body.queryByRole("dialog", { name: "Playthrough saved" }),
      ).not.toBeInTheDocument(),
    );
  },
};
export const ErrorWithRecovery: Story = {
  render: () => (
    <Button
      onClick={() => {
        const id = toast.add({
          title: "Couldn’t save the list",
          description: "Your draft is kept. Check your connection and retry.",
          type: "error",
          timeout: 0,
          actionProps: {
            children: "Retry save",
            onClick: () => {
              toast.close(id);
              toast.add({ title: "List saved", type: "success" });
            },
          },
        });
      }}
    >
      Try a failed save
    </Button>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Try a failed save" }),
    );
    const notification = await body.findByRole("dialog", {
      name: "Couldn’t save the list",
    });
    const retry = within(notification).getByRole("button", {
      name: "Retry save",
    });
    retry.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(body.getByRole("dialog", { name: "List saved" })).toBeVisible(),
    );
  },
};
export const LongContent: Story = {
  render: () => (
    <Button
      onClick={() =>
        toast.add({
          title: "Playthrough saved",
          description:
            "日本語のゲーム — مغامرة طويلة — ALongUnbrokenGameTitleThatMustWrapWithoutPushingTheControlsOutsideTheNotification",
          type: "success",
          timeout: 0,
        })
      }
    >
      Save a long title
    </Button>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
};
export const LightTheme: Story = { ...Success, globals: { theme: "light" } };
