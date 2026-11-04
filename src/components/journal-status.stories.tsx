import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { JournalStatus, type SaveJournalStatus } from "./journal-status";

const meta = {
  title: "Product/Journal status",
  component: JournalStatus,
  args: {
    entry: null,
    gameTitle: "Celeste",
    playthroughCount: 0,
    disabled: false,
    onSave: fn<SaveJournalStatus>(async () => undefined),
  },
  parameters: {
    docs: {
      description: {
        component:
          "Product control for Journal Status, Completion tags, announcements, and safe removal. Reuse this component instead of assembling a new game-save menu. Callbacks in this catalog are local test doubles; no Journal data is saved. Source: src/components/journal-status.tsx.",
      },
    },
  },
} satisfies Meta<typeof JournalStatus>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AddGame: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Add to Journal for Celeste" }),
    );
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole(
        "menuitemradio",
        { name: "playing" },
      ),
    );
    await waitFor(() =>
      expect(args.onSave).toHaveBeenCalledWith("playing", null, false),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Celeste: Playing.",
    );
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole("menu", {
          hidden: true,
        }),
      ).not.toBeInTheDocument(),
    );
  },
};
export const PlayedWithTag: Story = {
  args: {
    entry: { status: "played", completionTag: "completed" },
    playthroughCount: 2,
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const FailedSave: Story = {
  args: {
    onSave: fn<SaveJournalStatus>(async () => ({
      error: "Couldn’t save. Check your connection and try again.",
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", {
      name: "Add to Journal for Celeste",
    });
    await userEvent.click(trigger);
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole(
        "menuitemradio",
        { name: "backlog" },
      ),
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Couldn’t save.",
    );
    await expect(trigger).toHaveAccessibleName("Add to Journal for Celeste");
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole("menu", {
          hidden: true,
        }),
      ).not.toBeInTheDocument(),
    );
  },
};
export const LightTheme: Story = { globals: { theme: "light" } };

export const Pending: Story = {
  args: {
    onSave: fn<SaveJournalStatus>(() => new Promise<undefined>(() => {})),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", {
      name: "Add to Journal for Celeste",
    });
    await userEvent.click(trigger);
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole(
        "menuitemradio",
        { name: "backlog" },
      ),
    );
    await expect(trigger).toHaveAttribute("aria-busy", "true");
    await expect(trigger).toHaveAttribute("aria-disabled", "true");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Saving journal status…",
    );
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole("menu", {
          hidden: true,
        }),
      ).not.toBeInTheDocument(),
    );
  },
};
