import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, spyOn, userEvent, within } from "storybook/test";
import { CopyButton } from "./copy-button";

const meta = {
  title: "Product/Copy button",
  component: CopyButton,
  args: {
    text: "https://shelve.games/u/player",
    inputId: "copy-story-url",
    target: "profile",
  },
  beforeEach: () => {
    const clipboard = spyOn(
      navigator.clipboard,
      "writeText",
    ).mockResolvedValue();
    return () => clipboard.mockRestore();
  },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor={args.inputId}>Public profile URL</label>
      <input id={args.inputId} readOnly value={args.text} />
      <CopyButton {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Copy profile, Calendar feed, or public List URLs. Mounted icons cross-fade for 300ms with cubic-bezier(0.2, 0, 0, 1); reduced motion removes scale and blur. Keeps clipboard recovery and a two-second reset. Clipboard writes are local mocks in this catalog.",
      },
    },
  },
} satisfies Meta<typeof CopyButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Copy" }));
    await expect(
      await canvas.findByRole("button", { name: "Copied" }),
    ).toBeVisible();
  },
};
export const Failure: Story = {
  beforeEach: () => {
    const clipboard = spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("Clipboard denied"),
    );
    return () => clipboard.mockRestore();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Copy" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "copy it manually",
    );
    await expect(canvas.getByRole("textbox")).toHaveFocus();
  },
};
