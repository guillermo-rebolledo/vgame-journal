import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "./avatar";

const meta = {
  title: "UI/Avatar",
  component: Avatar,
  subcomponents: { AvatarFallback, AvatarImage, AvatarGroup, AvatarGroupCount },
  args: { size: "default" },
  render: (args) => (
    <Avatar {...args} role="img" aria-label="Player">
      <AvatarFallback>P</AvatarFallback>
    </Avatar>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "User identity with an initials fallback for missing or failed photos. Pair with visible names, or supply an accessible name when used alone. Source: src/components/ui/avatar.tsx.",
      },
    },
  },
} satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Fallback: Story = {};
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {(["sm", "default", "lg"] as const).map((size) => (
        <Avatar
          size={size}
          key={size}
          role="img"
          aria-label={`Player, ${size}`}
        >
          <AvatarFallback>P</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
};
export const Group: Story = {
  render: () => (
    <AvatarGroup>
      {["A", "B", "C"].map((name) => (
        <Avatar key={name} role="img" aria-label={`Player ${name}`}>
          <AvatarFallback>{name}</AvatarFallback>
        </Avatar>
      ))}
      <AvatarGroupCount aria-label="2 more players">+2</AvatarGroupCount>
    </AvatarGroup>
  ),
};
