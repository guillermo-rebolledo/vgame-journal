import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "UI/Input",
  component: Input,
  args: { id: "game-title", placeholder: "Search your games" },
  render: (args) => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor={args.id}>Game title</Label>
      <Input {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Single-line text input. Pair with Label, or compose Field for help and error messages. Placeholder text supplements the visible label. Source: src/components/ui/input.tsx.",
      },
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Game title",
    });
    await userEvent.type(input, "Pokémon 日本語");
    await expect(input).toHaveValue("Pokémon 日本語");
  },
};
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Celeste" },
};
export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    "aria-describedby": "input-error",
    defaultValue: "",
  },
  render: (args) => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor={args.id}>Game title</Label>
      <Input {...args} />
      <p id="input-error" className="text-sm text-destructive">
        Enter a game title.
      </p>
    </div>
  ),
};
export const LightTheme: Story = { globals: { theme: "light" } };
