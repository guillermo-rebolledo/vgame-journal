import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";
import { Input } from "./input";

const meta = {
  title: "UI/Drawer",
  component: Drawer,
  subcomponents: {
    DrawerTrigger,
    DrawerContent,
    DrawerTitle,
    DrawerDescription,
    DrawerClose,
  },
  args: { showSwipeHandle: true },
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger render={<Button variant="outline" />}>
        Open editor
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Playthrough editor</DrawerTitle>
          <DrawerDescription>
            Record your time with a game. Notes stay private.
          </DrawerDescription>
        </DrawerHeader>
        <p className="p-4 text-sm">
          Use PlaythroughForm or GameRecording for the complete recording flow.
        </p>
        <DrawerFooter>
          <DrawerClose render={<Button variant="outline" />}>
            Cancel
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Modal sheet with a title, description, keyboard dismissal, focus containment, and focus restoration. Vertical drawers span the screen width; bottom drawers attach to the bottom edge on desktop and mobile. A 60% black modal backdrop dims the page. They fit their content on every screen and scroll above their viewport limit; desktop allows all but 32px of viewport height. Use the existing product editor for Playthroughs and lists. Source: src/components/ui/drawer.tsx.",
      },
    },
  },
} satisfies Meta<typeof Drawer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OpenAndDismiss: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Open editor",
    });
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await body.findByRole("dialog", { name: "Playthrough editor" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(trigger).toHaveFocus();
  },
};
export const Open: Story = {
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const document = canvasElement.ownerDocument;
    const dialog = await within(document.body).findByRole("dialog", {
      name: "Playthrough editor",
    });
    await waitFor(() => {
      const bounds = dialog.getBoundingClientRect();
      expect(bounds.height).toBeLessThan(400);
      expect(bounds.left).toBe(0);
      expect(bounds.width).toBe(document.documentElement.clientWidth);
      expect(bounds.bottom).toBeCloseTo(
        document.defaultView?.innerHeight ?? 0,
        1,
      );
    });
    const overlay = document.querySelector('[data-slot="drawer-overlay"]');
    if (!overlay) throw new Error("Modal backdrop missing");
    expect(getComputedStyle(overlay).backgroundColor).toBe(
      "oklab(0 0 0 / 0.6)",
    );
  },
};

export const KeepMountedDraft: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger render={<Button />}>Open draft</DrawerTrigger>
      <DrawerContent keepMounted>
        <DrawerHeader>
          <DrawerTitle>Draft editor</DrawerTitle>
          <DrawerDescription>Closing keeps your draft.</DrawerDescription>
        </DrawerHeader>
        <div className="p-4">
          <label htmlFor="drawer-draft">Draft title</label>
          <Input id="drawer-draft" />
        </div>
      </DrawerContent>
    </Drawer>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Open draft",
    });
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(trigger);
    await userEvent.type(
      await body.findByRole("textbox", { name: "Draft title" }),
      "Keep this draft",
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await expect(
      await body.findByRole("textbox", { name: "Draft title" }),
    ).toHaveValue("Keep this draft");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(trigger).toHaveFocus();
  },
};
