import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { PlaythroughForm, type SavePlaythrough } from "./playthrough-form";

const meta = {
  title: "Product/Playthrough form",
  component: PlaythroughForm,
  args: {
    platforms: ["PC", "Nintendo Switch"],
    initial: { platform: "PC", startedOn: "2026-02-02" },
    onSave: fn<SavePlaythrough>(async () => undefined),
    onSuccess: fn(),
    onCancel: fn(),
    onDraft: fn(),
    onPending: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl rounded-lg border">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Playthrough fields with pending feedback, private notes, draft callbacks, and retryable save errors. Use inside GameRecording for the production drawer and persistence flow. This catalog uses local callback fixtures and never accesses a database. Source: src/components/playthrough-form.tsx.",
      },
    },
  },
} satisfies Meta<typeof PlaythroughForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Save: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText("Notes (private, optional)"),
      "A climb worth remembering.",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(args.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: "PC",
          startedOn: "2026-02-02",
          notes: "A climb worth remembering.",
        }),
      ),
    );
    await expect(args.onSuccess).toHaveBeenCalledOnce();
  },
};
export const FirstPlaythrough: Story = { args: { outsideJournal: true } };
export const NoPlatforms: Story = { args: { platforms: [] } };
export const FailedSaveKeepsDraft: Story = {
  args: {
    onSave: fn<SavePlaythrough>(async () => ({
      error: "Couldn’t save. Your inputs are still here.",
    })),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const notes = canvas.getByLabelText("Notes (private, optional)");
    await userEvent.type(notes, "Keep this draft.");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Your inputs are still here.",
    );
    await expect(notes).toHaveValue("Keep this draft.");
    await expect(args.onSuccess).not.toHaveBeenCalled();
  },
};
export const LightTheme: Story = { globals: { theme: "light" } };

export const RemovedInAnotherTabKeepsDraft: Story = {
  ...FailedSaveKeepsDraft,
  args: {
    onSave: fn<SavePlaythrough>(async () => ({
      error:
        "This Playthrough is no longer available. Your draft is still here.",
    })),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const notes = canvas.getByLabelText("Notes (private, optional)");
    await userEvent.type(notes, "Keep this draft.");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "no longer available",
    );
    await expect(notes).toHaveValue("Keep this draft.");
    await expect(args.onSuccess).not.toHaveBeenCalled();
  },
};

export const Pending: Story = {
  args: { onSave: fn<SavePlaythrough>(() => new Promise(() => {})) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();
    const status = canvas.getByRole("status");
    await expect(status.querySelector(".shimmer")).toHaveTextContent("Saving…");
    await expect(
      status.querySelector('[data-active="true"] [data-slot="spinner"]'),
    ).toHaveAttribute("aria-hidden", "true");
  },
};
