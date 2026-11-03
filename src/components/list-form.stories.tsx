import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { ListFields } from "./list-form";

const meta = {
  title: "Product/List fields",
  component: ListFields,
  args: { title: "", description: "", onTitle: fn(), onDescription: fn() },
  render: function Example(args) {
    const [title, setTitle] = useState(args.title);
    const [description, setDescription] = useState(args.description);
    return (
      <div className="max-w-xl">
        <ListFields
          {...args}
          title={title}
          description={description}
          onTitle={setTitle}
          onDescription={setDescription}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "Shared list title and optional description fields for creation and editing. Supports associated title errors, disabled state, wrapping help, and mobile input sizing. Form controllers own validation and persistence.",
      },
    },
  },
} satisfies Meta<typeof ListFields>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole("textbox", { name: "List title" }),
      "Weekend games",
    );
    await expect(
      canvas.getByRole("textbox", { name: "List title" }),
    ).toHaveValue("Weekend games");
    await expect(
      canvas.getByRole("textbox", {
        name: "Description (optional)",
      }),
    ).toHaveAccessibleDescription("Up to 2,000 characters.");
  },
};
export const ValidationError: Story = {
  args: { titleError: "Enter a list title." },
  play: async ({ canvasElement }) => {
    const title = within(canvasElement).getByRole("textbox", {
      name: "List title",
    });
    await expect(title).toHaveAttribute("aria-invalid", "true");
    await expect(title).toHaveAccessibleDescription("Enter a list title.");
  },
};
export const LongContent: Story = {
  args: {
    title:
      "Games to play with friends across a very long winter weekend — 日本語",
    description: "One line\nAnother line",
  },
};
export const Pending: Story = {
  args: { title: "Weekend games", disabled: true },
};
export const LightTheme: Story = { globals: { theme: "light" } };
