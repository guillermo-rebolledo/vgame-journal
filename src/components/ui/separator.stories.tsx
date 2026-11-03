import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Separator } from "./separator";

const meta = {
  title: "UI/Separator",
  component: Separator,
  args: { orientation: "horizontal" },
  parameters: {
    docs: {
      description: {
        component:
          "Quiet visual divider. Group related content with layout first; use a divider when the boundary helps scanning. Source: src/components/ui/separator.tsx.",
      },
    },
  },
  render: (args) => (
    <div className="grid max-w-sm gap-4 text-sm">
      <span>Playing</span>
      <Separator {...args} />
      <span>Backlog</span>
    </div>
  ),
} satisfies Meta<typeof Separator>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Horizontal: Story = {};
export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-4 text-sm">
      <span>Grid view</span>
      <Separator orientation="vertical" />
      <span>List view</span>
    </div>
  ),
};
