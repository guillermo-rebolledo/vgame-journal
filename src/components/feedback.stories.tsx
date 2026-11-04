import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import { Feedback, type SubmitFeedback } from "./feedback";

const meta = {
  title: "Product/Feedback",
  component: Feedback,
  args: {
    username: "catalog-player",
    onSubmit: fn<SubmitFeedback>(async () => undefined),
  },
  parameters: {
    docs: {
      description: {
        component:
          "Feedback editor with retained drafts on failure and a stable success announcement inside the drawer. It remains open so the player can read the confirmation and close it. Submissions are local callbacks.",
      },
    },
  },
} satisfies Meta<typeof Feedback>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Confirmed: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Send feedback" }),
    );
    await userEvent.type(
      body.getByRole("textbox", { name: "Message" }),
      "Please add shelves.",
    );
    await userEvent.click(body.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(body.getByRole("status")).toHaveTextContent("Feedback sent."),
    );
    await expect(
      body.getByRole("heading", { name: "Thanks, got it." }),
    ).toBeVisible();
    await userEvent.click(body.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(
        within(canvasElement).getByRole("button", { name: "Send feedback" }),
      ).toHaveFocus(),
    );
  },
};
export const FailedAndRetry: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onSubmit)
      .mockReset()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue(undefined);
  },
  args: {
    onSubmit: fn<SubmitFeedback>()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue(undefined),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Send feedback" }),
    );
    await userEvent.type(
      body.getByRole("textbox", { name: "Message" }),
      "Keep my message.",
    );
    await userEvent.click(body.getByRole("button", { name: "Send" }));
    await expect(await body.findByRole("alert")).toHaveTextContent(
      "Your message is still here.",
    );
    await expect(body.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Keep my message.",
    );
    await userEvent.click(body.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(body.getByRole("status")).toHaveTextContent("Feedback sent."),
    );
  },
};
