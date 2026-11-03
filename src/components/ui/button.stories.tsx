import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: {
    children: "Add to Journal",
    variant: "default",
    size: "default",
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "outline",
        "secondary",
        "ghost",
        "destructive",
        "link",
      ],
    },
    size: {
      control: "select",
      options: [
        "default",
        "xs",
        "sm",
        "lg",
        "icon",
        "icon-xs",
        "icon-sm",
        "icon-lg",
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Shared action control. Enabled presses scale to 0.96 over 150ms with ease-out; reduced motion stays stationary. Use press=static for anchored triggers. Reuse a variant for emphasis; use a link for navigation. Icon-only buttons need an accessible name. Source: src/components/ui/button.tsx.",
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", {
      name: "Add to Journal",
    });
    button.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      {(
        [
          "default",
          "outline",
          "secondary",
          "ghost",
          "destructive",
          "link",
        ] as const
      ).map((variant) => (
        <Button {...args} key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};
export const Disabled: Story = { args: { disabled: true } };
export const IconOnly: Story = {
  args: { size: "icon", "aria-label": "Add game", children: <Plus /> },
};
export const LongLabel: Story = {
  args: {
    children:
      "Add The Lantern Keeper and the Library Beyond the Last Horizon to your Journal",
    className: "max-w-64",
  },
};
export const LightTheme: Story = { globals: { theme: "light" } };

export const StaticTrigger: Story = {
  args: { press: "static", children: "Open actions" },
};
export const FocusableDisabled: Story = {
  args: { disabled: true, focusableWhenDisabled: true },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button");
    button.focus();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
