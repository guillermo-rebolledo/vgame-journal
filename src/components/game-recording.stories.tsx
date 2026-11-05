import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import {
  expect,
  fireEvent,
  fn,
  userEvent,
  waitFor,
  within,
} from "storybook/test";
import { GameListPicker } from "./game-list-picker";
import { GameRecording } from "./game-recording";

const meta = {
  title: "Product/Game recording",
  component: GameRecording,
  parameters: {
    docs: {
      description: {
        component:
          "Grouped game actions, confirmed Journal feedback, and a single empty/populated Playthroughs section. Pass the server-rendered list picker through listPicker; its trigger and full-width panel participate in the wrapping action group. JournalStatus accepts additional actions rather than duplicating its menu or feedback. Reuses Drawer, JournalStatus, PlaythroughForm, and PlaythroughHistory. Deletion returns focus to Add playthrough even when refreshed history arrives after dismissal. Catalog callbacks are local and never access a database.",
      },
    },
  },
  args: {
    signedIn: true,
    entry: { status: "playing", completionTag: null },
    gameTitle: "Celeste",
    platforms: ["PC"],
    playthroughs: [
      {
        id: 7,
        userId: "catalog-player",
        gameId: 1,
        platform: "PC",
        startedOn: "2026-02-02",
        endedOn: null,
        hours: null,
        notes: "A climb worth remembering.",
        submissionId: null,
      },
    ],
    onStatus: fn(async () => undefined),
    onAdd: fn(async () => undefined),
    onUpdate: fn(async () => undefined),
    onRemove: fn(async () => undefined),
  },
} satisfies Meta<typeof GameRecording>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DeleteWithDelayedHistory: Story = {
  render: function Recording(args) {
    const [playthroughs, setPlaythroughs] = useState(args.playthroughs);
    return (
      <GameRecording
        {...args}
        playthroughs={playthroughs}
        onRemove={async () => {
          // Model the refreshed history arriving after the drawer has closed.
          setTimeout(() => setPlaythroughs([]), 1000);
          return undefined;
        }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Edit" }));
    await userEvent.click(
      await body.findByRole("button", { name: "Delete playthrough" }),
    );
    await waitFor(
      () => expect(canvas.getByText("No playthroughs yet.")).toBeVisible(),
      { timeout: 3000 },
    );
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Add playthrough" }),
      ).toHaveFocus(),
    );
    await waitFor(() =>
      expect(
        body.getByRole("dialog", { name: "Playthrough deleted" }),
      ).toBeVisible(),
    );
  },
};

export const GroupedActions: Story = {
  args: {
    playthroughs: [],
    listPicker: (
      <GameListPicker
        actor={null}
        needsUsername={false}
        game={{ id: 1, slug: "celeste", title: "Celeste" }}
      />
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const actions = within(canvas.getByRole("group", { name: "Game actions" }));
    await userEvent.click(
      actions.getByRole("button", {
        name: "Change Journal status for Celeste",
      }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole("menu")).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        actions.getByRole("button", {
          name: "Change Journal status for Celeste",
        }),
      ).toHaveFocus(),
    );
    await userEvent.tab();
    await expect(
      actions.getByRole("button", { name: "Add playthrough" }),
    ).toHaveFocus();
    await userEvent.tab();
    const lists = actions.getByRole("button", { name: "Add to list" });
    await expect(lists).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const picker = canvas.getByRole("region", {
      name: "Add Celeste to a list",
    });
    await waitFor(() => expect(picker).toHaveFocus());
    await expect(canvas.getByText("Playing", { exact: true })).toBeVisible();
    await expect(
      canvas.getByRole("region", { name: "Playthroughs" }),
    ).toHaveTextContent("No playthroughs yet.");
    await userEvent.click(
      actions.getByRole("button", { name: "Close list picker" }),
    );
    await expect(lists).toHaveFocus();
  },
};

export const GuestActions: Story = {
  args: { ...GroupedActions.args, signedIn: false, entry: null },
};
export const UnsavedActions: Story = {
  args: { ...GroupedActions.args, entry: null },
};
export const GroupedActionsLight: Story = {
  ...GroupedActions,
  globals: { theme: "light" },
};

export const SaveConfirmsAfterDismissal: Story = {
  args: { playthroughs: [] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Add playthrough" });
    await userEvent.click(trigger);
    const editor = within(
      await body.findByRole("dialog", { name: "Add playthrough" }),
    );
    await fireEvent.change(editor.getByLabelText("Started"), {
      target: { value: "2026-11-01" },
    });
    await userEvent.click(editor.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(
        body.getByRole("dialog", { name: "Playthrough saved" }),
      ).toBeVisible(),
    );
    await expect(
      body.queryByRole("dialog", { name: "Add playthrough" }),
    ).not.toBeInTheDocument();
    await expect(trigger).toHaveFocus();
    await expect(args.onAdd).toHaveBeenCalledOnce();
  },
};

export const SavingOnlyMarksTheSaveAction: Story = {
  args: { onUpdate: fn(() => new Promise<undefined>(() => {})) },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Edit" }),
    );
    const save = await body.findByRole("button", { name: "Save" });
    await userEvent.click(save);
    await expect(save).toHaveAttribute("aria-busy", "true");
    await expect(
      save.querySelector('[data-active="true"] [data-slot="spinner"]'),
    ).toBeVisible();
    const remove = body.getByRole("button", { name: "Delete playthrough" });
    await expect(remove).toBeDisabled();
    await expect(
      remove.querySelector('[data-active="true"] [data-slot="spinner"]'),
    ).toBeNull();
    await expect(body.getByText("Saving…", { exact: true })).toBeVisible();
  },
};

export const DeletingOnlyMarksTheDeleteAction: Story = {
  args: { onRemove: fn(() => new Promise<undefined>(() => {})) },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Edit" }),
    );
    const remove = await body.findByRole("button", {
      name: "Delete playthrough",
    });
    await userEvent.click(remove);
    await expect(remove).toHaveAttribute("aria-busy", "true");
    await expect(
      remove.querySelector('[data-active="true"] [data-slot="spinner"]'),
    ).toBeVisible();
    const save = body.getByRole("button", { name: "Save" });
    await expect(save).toBeDisabled();
    await expect(
      save.querySelector('[data-active="true"] [data-slot="spinner"]'),
    ).toBeNull();
    await expect(
      body.queryByText("Saving…", { exact: true }),
    ).not.toBeInTheDocument();
    await expect(
      body.getByText("Deleting playthrough…", { exact: true }),
    ).toBeVisible();
  },
};
