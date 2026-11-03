import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "./field";
import { Input } from "./input";

const meta = {
  title: "UI/Field",
  component: Field,
  subcomponents: {
    FieldLabel,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldSet,
    FieldLegend,
    FieldContent,
  },
  args: { orientation: "vertical" },
  parameters: {
    docs: {
      description: {
        component:
          "Compose labels, controls, help, and validation as one group. Associate descriptions and errors using aria-describedby; Field does not wire these IDs automatically. Source: src/components/ui/field.tsx.",
      },
    },
  },
} satisfies Meta<typeof Field>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WithHelp: Story = {
  render: (args) => (
    <Field {...args} className="max-w-sm">
      <FieldLabel htmlFor="notes-title">Playthrough title</FieldLabel>
      <Input id="notes-title" aria-describedby="title-help" />
      <FieldDescription id="title-help">
        Choose a title you will recognize later.
      </FieldDescription>
    </Field>
  ),
};
export const ValidationError: Story = {
  render: (args) => (
    <Field {...args} className="max-w-sm" data-invalid>
      <FieldLabel htmlFor="started">Started</FieldLabel>
      <Input
        id="started"
        type="date"
        aria-invalid
        aria-describedby="started-error"
      />
      <FieldError id="started-error">
        Enter the date you started playing.
      </FieldError>
    </Field>
  ),
};
export const GroupedFields: Story = {
  render: () => (
    <FieldSet className="max-w-sm">
      <FieldLegend>Playthrough dates</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="group-start">Started</FieldLabel>
          <Input id="group-start" type="date" />
        </Field>
        <Field>
          <FieldLabel htmlFor="group-end">Finished (optional)</FieldLabel>
          <Input id="group-end" type="date" />
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
};
export const LightTheme: Story = { ...WithHelp, globals: { theme: "light" } };
