import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { GameRecording } from "./game-recording";

const meta = {
  title: "Product/Game recording",
  component: GameRecording,
  parameters: {
    docs: {
      description: {
        component:
          "Journal controls and Playthrough editor composition. Reuses Drawer, JournalStatus, PlaythroughForm, and PlaythroughHistory. Deletion returns focus to Add playthrough even when refreshed history arrives after dismissal. Catalog callbacks are local and never access a database.",
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
  },
};
