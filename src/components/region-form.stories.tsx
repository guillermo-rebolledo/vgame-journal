import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import { RegionForm } from "./region-form";

const meta = {
  title: "Product/Release region",
  component: RegionForm,
  args: {
    current: "earliest",
    onSave: fn(async () => ({ saved: true as const })),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Release region preferences with retained selection, local pending feedback, retry, and a confirmed check beside Save. Catalog callbacks do not save data.",
      },
    },
  },
} satisfies Meta<typeof RegionForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Save: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: /Japan/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("Saved"),
    );
    await userEvent.click(canvas.getByRole("radio", { name: /Europe/ }));
    await expect(canvas.getByRole("status")).toBeEmptyDOMElement();
  },
};
export const FailedSaveAndRetry: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onSave)
      .mockReset()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue({ saved: true });
  },
  args: {
    onSave: fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue({ saved: true }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: /Japan/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Please try again.",
    );
    await expect(canvas.getByRole("radio", { name: /Japan/ })).toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("Saved"),
    );
  },
};
export const Pending: Story = {
  beforeEach: ({ args }) => {
    let finish:
      | ((value: Awaited<ReturnType<typeof args.onSave>>) => void)
      | undefined;
    mocked(args.onSave).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    return () => finish?.({ saved: true });
  },
  args: { onSave: fn(() => new Promise(() => {})) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();
    await expect(canvas.getByRole("status")).toHaveTextContent("Saving…");
  },
};
