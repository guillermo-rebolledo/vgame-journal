import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Field, FieldLabel } from "./field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const items = [
  { value: "backlog", label: "Backlog" },
  { value: "playing", label: "Playing" },
  { value: "played", label: "Played" },
  { value: "wishlist", label: "Wishlist" },
];
const meta = {
  title: "UI/Select",
  component: SelectTrigger,
  subcomponents: { Select, SelectContent, SelectItem, SelectValue },
  args: { size: "default", disabled: false },
  render: (args) => (
    <Field className="max-w-xs">
      <FieldLabel htmlFor="select-status">Status</FieldLabel>
      <Select defaultValue="backlog" items={items}>
        <SelectTrigger {...args} id="select-status" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Base UI single-choice control. Supply items so the selected value has a readable label; associate the trigger with FieldLabel. Popup content is portaled. Source: src/components/ui/select.tsx.",
      },
    },
  },
} satisfies Meta<typeof SelectTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ChooseStatus: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("combobox", {
      name: "Status",
    });
    await userEvent.click(trigger);
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "Playing",
      }),
    );
    await expect(trigger).toHaveTextContent("Playing");
    await waitFor(() => expect(trigger).toHaveFocus());
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole("listbox"),
      ).not.toBeInTheDocument(),
    );
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const Small: Story = { args: { size: "sm" } };
