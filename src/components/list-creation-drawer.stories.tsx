import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useRef, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ListCreationDrawer, ListEditorDrawer } from "./list-creation-drawer";
import { ListFields, ListVisibilityFields } from "./list-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const meta = {
  title: "Product/List creation drawer",
  component: ListCreationDrawer,
  subcomponents: { ListEditorDrawer },
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
            loading={args.pending}
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
          "Create-list composition using the shared Drawer and Playthrough editor viewport sizing. Spans the full screen width and attaches to the bottom on desktop and mobile. Fits its content on desktop and mobile, scrolling only above the viewport limit. Mobile retains its keyboard-aware maximum; the shared Drawer anchors it above browser toolbars and the software keyboard. A dimmed backdrop keeps attention on the editor. Keeps focus inside, restores the trigger on dismissal, and prevents dismissal during submission. CreateListForm supplies persistence in the app; these stories use local state only.",
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
export const ResizedDescription: Story = {
  args: { open: true },
  play: async ({ canvasElement }) => {
    const document = canvasElement.ownerDocument;
    const body = within(document.body);
    const dialog = await body.findByRole("dialog", { name: "Create a list" });
    const description = within(dialog).getByRole("textbox", {
      name: "Description (optional)",
    });
    // A player can resize the description beyond the available screen height.
    description.style.height = `${document.defaultView?.innerHeight ?? 1000}px`;
    const submit = within(dialog).getByRole("button", { name: "Create list" });
    submit.focus();
    await waitFor(() => {
      const bounds = submit.getBoundingClientRect();
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).toBeLessThanOrEqual(
        document.defaultView?.innerHeight ?? 1000,
      );
    });
  },
};
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

export const EditDetails: Story = {
  render: function EditExample() {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("Weekend games");
    const [description, setDescription] = useState("");
    return (
      <ListEditorDrawer
        open={open}
        onOpenChange={setOpen}
        title="Edit list"
        description="Update the title and description. Closing keeps your draft."
        trigger={<Button variant="outline">Edit details</Button>}
      >
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 sm:p-6">
          <ListFields
            title={title}
            description={description}
            onTitle={setTitle}
            onDescription={setDescription}
          />
          <Button onClick={() => setOpen(false)}>Save details</Button>
        </div>
      </ListEditorDrawer>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Edit details" });
    await userEvent.click(trigger);
    const title = await body.findByRole("textbox", { name: "List title" });
    await userEvent.clear(title);
    await userEvent.type(title, "A retained draft");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    await expect(
      await body.findByRole("textbox", { name: "List title" }),
    ).toHaveValue("A retained draft");
  },
};

export const FocusedSearch: Story = {
  render: function SearchExample() {
    const [open, setOpen] = useState(false);
    const search = useRef<HTMLInputElement>(null);
    return (
      <ListEditorDrawer
        open={open}
        onOpenChange={setOpen}
        title="Add games"
        description="Search the Catalog and add games to this list."
        initialFocus={search}
        trigger={<Button>Add games</Button>}
      >
        <div className="mx-auto w-full max-w-xl p-4 sm:p-6">
          <label htmlFor="story-list-search">Search games</label>
          <Input ref={search} id="story-list-search" type="search" />
        </div>
      </ListEditorDrawer>
    );
  },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Add games",
    });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(
        body.getByRole("searchbox", { name: "Search games" }),
      ).toHaveFocus(),
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

// Model Chrome toolbar changes while the fixed containing block retains its height.
export const BottomBrowserToolbar: Story = {
  play: async ({ canvasElement }) => {
    const win = canvasElement.ownerDocument.defaultView;
    if (!win) throw new Error("Window missing");
    const heightDescriptor = Object.getOwnPropertyDescriptor(
      win,
      "innerHeight",
    );
    const viewport = win.visualViewport;
    if (!viewport) throw new Error("Visual viewport missing");
    const viewportHeight = viewport.height - 120;
    Object.defineProperty(viewport, "height", {
      configurable: true,
      value: viewportHeight,
    });
    Object.defineProperty(win, "innerHeight", {
      configurable: true,
      get: () => viewport.height,
    });
    const body = within(canvasElement.ownerDocument.body);
    try {
      await userEvent.click(
        within(canvasElement).getByRole("button", { name: "Create a list" }),
      );
      const dialog = await body.findByRole("dialog", { name: "Create a list" });
      for (const height of [
        viewport.height,
        viewport.height - 100,
        viewport.height,
      ]) {
        Object.defineProperty(viewport, "height", {
          configurable: true,
          value: height,
        });
        viewport.dispatchEvent(new Event("resize"));
        const submit = within(dialog).getByRole("button", {
          name: "Create list",
        });
        submit.focus();
        await waitFor(() => {
          expect(dialog.getBoundingClientRect().bottom).toBeCloseTo(height, 0);
          expect(submit.getBoundingClientRect().bottom).toBeLessThanOrEqual(
            height,
          );
        });
      }
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(dialog).not.toBeVisible());
      await expect(
        within(canvasElement).getByRole("button", { name: "Create a list" }),
      ).toHaveFocus();
    } finally {
      if (heightDescriptor)
        Object.defineProperty(win, "innerHeight", heightDescriptor);
      Reflect.deleteProperty(viewport, "height");
      viewport.dispatchEvent(new Event("resize"));
    }
  },
};
