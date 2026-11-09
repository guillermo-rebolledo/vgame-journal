import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import { CalendarFeedForm } from "./calendar-feed-form";

const meta = {
  title: "Product/Calendar feed",
  component: CalendarFeedForm,
  args: {
    url: "https://shelve.games/api/calendar/catalog-example.ics",
    onRegenerate: fn(async () => ({ saved: true as const })),
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
          "Calendar subscription and private URL controls. Regeneration prevents duplicate requests and confirms only the received server result. Errors stay inline; the server supplies the refreshed URL. Actions are local fixtures here.",
      },
    },
  },
} satisfies Meta<typeof CalendarFeedForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Regenerate: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/without signing in/)).toBeVisible();
    await expect(canvas.getByText(/already downloaded/)).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Regenerate URL" }),
    );
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("Regenerated"),
    );
    await expect(args.onRegenerate).toHaveBeenCalledOnce();
  },
};
export const Pending: Story = {
  beforeEach: ({ args }) => {
    let finish:
      | ((value: Awaited<ReturnType<typeof args.onRegenerate>>) => void)
      | undefined;
    mocked(args.onRegenerate).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    return () => finish?.({ saved: true });
  },
  args: { onRegenerate: fn(() => new Promise(() => {})) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Regenerate URL" });
    button.focus();
    await userEvent.keyboard("{Enter}{Enter}");
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(args.onRegenerate).toHaveBeenCalledOnce();
    await expect(canvas.getByRole("status")).toHaveTextContent("Regenerating…");
  },
};
export const FailedAndRetry: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onRegenerate)
      .mockReset()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue({ saved: true });
  },
  args: {
    onRegenerate: fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue({ saved: true }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Regenerate URL" });
    await userEvent.click(button);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Refresh Settings and try again.",
    );
    await expect(canvas.getByRole("status")).not.toHaveTextContent(
      "Regenerated",
    );
    await expect(canvas.getByRole("textbox")).toHaveValue(
      "https://shelve.games/api/calendar/catalog-example.ics",
    );
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("Regenerated"),
    );
  },
};
