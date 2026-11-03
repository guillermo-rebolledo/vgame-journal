import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ListCreationDrawer } from "./list-creation-drawer";
import { ListFields, ListVisibilityFields } from "./list-form";
import { Button } from "./ui/button";

const meta = {
  title: "Product/List creation drawer",
  component: ListCreationDrawer,
  args: { open: false, pending: false, onOpenChange: fn(), children: null },
  render: function Example(args) {
    const [open, setOpen] = useState(args.open);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [visibility, setVisibility] = useState<"private" | "public">(
      "private",
    );
    return (
      <ListCreationDrawer {...args} open={open} onOpenChange={setOpen}>
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 sm:p-6">
          <ListFields
            title={title}
            description={description}
            onTitle={setTitle}
            onDescription={setDescription}
            disabled={args.pending}
          />
          <fieldset disabled={args.pending}>
            <ListVisibilityFields value={visibility} onChange={setVisibility} />
          </fieldset>
          <Button
            className="min-h-11 self-start"
            disabled={args.pending}
            onClick={() => setOpen(false)}
          >
            {args.pending ? "Creating…" : "Create list"}
          </Button>
        </div>
      </ListCreationDrawer>
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "Create-list composition using the shared Drawer and Playthrough editor viewport sizing. Keeps focus inside, restores the trigger on dismissal, and prevents dismissal during submission. CreateListForm supplies persistence in the app; these stories use local state only.",
      },
    },
  },
} satisfies Meta<typeof ListCreationDrawer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OpenAndDismiss: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Create a list",
    });
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", {
      name: "Create a list",
    });
    await expect(dialog).toBeVisible();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "List title" }),
      "Weekend games",
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await expect(
      await body.findByRole("textbox", { name: "List title" }),
    ).toHaveValue("Weekend games");
    await userEvent.click(body.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(trigger).toHaveFocus();
  },
};
export const Open: Story = { args: { open: true } };
export const Pending: Story = {
  args: { open: true, pending: true },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.keyboard("{Escape}");
    await expect(body.getByRole("dialog")).toBeVisible();
    await expect(body.getByRole("button", { name: "Close" })).toBeDisabled();
  },
};
export const LightTheme: Story = { ...Open, globals: { theme: "light" } };
