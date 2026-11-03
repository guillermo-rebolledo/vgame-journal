import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "UI/Label",
  component: Label,
  args: { children: "Hours played", htmlFor: "hours" },
  render: (args) => (
    <div className="grid max-w-sm gap-2">
      <Label {...args} />
      <Input id={args.htmlFor} type="number" min="0" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Visible form label associated with a control through htmlFor and id. Prefer FieldLabel when composing a Field. Source: src/components/ui/label.tsx.",
      },
    },
  },
} satisfies Meta<typeof Label>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AssociatedControl: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Hours played"));
    await expect(
      canvas.getByRole("spinbutton", { name: "Hours played" }),
    ).toHaveFocus();
  },
};
