import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { Checkbox } from "./checkbox";

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  parameters: {
    docs: {
      description: {
        component:
          "Base UI checkbox from shadcn. Pair with a visible label, preserve its keyboard handling, and give the label a 44px target.",
      },
    },
  },
  render: (args) => (
    <label
      htmlFor="example-check"
      className="flex min-h-11 items-center gap-3 text-sm"
    >
      <Checkbox id="example-check" {...args} />
      Include game
    </label>
  ),
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const checkbox = within(canvasElement).getByRole("checkbox");
    await checkbox.focus();
    await userEvent.keyboard(" ");
    await expect(checkbox).toBeChecked();
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const Checked: Story = { args: { defaultChecked: true } };
