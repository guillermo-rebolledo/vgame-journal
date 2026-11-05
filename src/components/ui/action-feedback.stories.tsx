import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Save } from "lucide-react";
import { expect, waitFor } from "storybook/test";
import { ActionFeedback, ActionIcon } from "./action-feedback";
import { Button } from "./button";

const meta = {
  title: "UI/Action feedback",
  component: ActionIcon,
  subcomponents: { ActionFeedback },
  args: { icon: <Save />, state: "idle" },
  argTypes: {
    state: {
      control: "select",
      options: ["idle", "pending", "success", "error"],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Decorative icon state layers, shared with CopyButton. Callers own request state, disablement and one stable live region. Keep the visible action label intact. Pending spinners and 300ms state transitions honor reduced motion; no entrance on mount. See UI/Button AsyncFeedback for keyboard, duplicate-submit and retry coverage.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    for (const icon of canvasElement.querySelectorAll(".action-icon")) {
      await waitFor(() => {
        const layers = [...icon.children];
        expect(
          layers.filter((layer) => getComputedStyle(layer).opacity === "1"),
        ).toHaveLength(1);
        for (const svg of icon.querySelectorAll("svg")) {
          expect(getComputedStyle(svg).width).toBe(
            getComputedStyle(icon).width,
          );
          expect(getComputedStyle(svg).height).toBe(
            getComputedStyle(icon).height,
          );
        }
        for (const layer of layers) {
          expect(getComputedStyle(layer).opacity).toBe(
            layer.getAttribute("data-active") === "true" ? "1" : "0",
          );
        }
      });
    }
  },
  render: (args) => (
    <Button
      disabled={args.state === "pending"}
      aria-busy={args.state === "pending"}
    >
      <ActionIcon {...args} />
      Save
    </Button>
  ),
} satisfies Meta<typeof ActionIcon>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Idle: Story = {};
export const Pending: Story = { args: { state: "pending" } };
export const Success: Story = { args: { state: "success" } };
export const Failed: Story = { args: { state: "error" } };
export const BesideAction: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <ActionIcon icon={<Save />} />
        Save
      </Button>
      <output>
        <ActionFeedback state="success">Saved</ActionFeedback>
      </output>
    </div>
  ),
};
export const LightTheme: Story = {
  globals: { theme: "light" },
  args: { state: "success" },
};
