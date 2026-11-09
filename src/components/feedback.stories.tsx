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
          "Feedback editor with retained drafts on failure and a stable success announcement inside the drawer. It remains open so the player can read the confirmation and close it. The account menu composes this editor through renderTrigger and finalFocus; see Product/Account menu for that keyboard flow. Submissions are local callbacks.",
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

export const GuidanceAndLongDraft: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Send feedback" }),
    );
    const message = body.getByRole("textbox", { name: "Message" });
    await userEvent.click(message);
    await userEvent.paste("A".repeat(1801));
    for (const [type, guidance] of [
      ["Bug", "What did you try, what happened, and what did you expect?"],
      ["Other", "Tell us about anything confusing or hard to use."],
      ["Idea", "What do you want to do, and how would it help?"],
    ]) {
      await userEvent.click(body.getByRole("combobox", { name: "Type" }));
      await userEvent.click(await body.findByRole("option", { name: type }));
      await expect(body.getByText(guidance)).toBeVisible();
      await expect(message).toHaveValue("A".repeat(1801));
    }
  },
};

export const Pending: Story = {
  args: { onSubmit: fn<SubmitFeedback>(() => new Promise(() => {})) },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Send feedback" }),
    );
    await userEvent.type(
      body.getByRole("textbox", { name: "Message" }),
      "Please help.",
    );
    await userEvent.click(body.getByRole("button", { name: "Send" }));
    await expect(body.getByRole("button", { name: "Send" })).toBeDisabled();
  },
};

export const Validation: Story = {
  args: {
    onSubmit: fn<SubmitFeedback>(async () => ({
      error: "Write a message between 1 and 2000 characters.",
    })),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Send feedback" }),
    );
    await userEvent.type(
      body.getByRole("textbox", { name: "Message" }),
      "Retain this draft.",
    );
    await userEvent.click(body.getByRole("button", { name: "Send" }));
    await expect(await body.findByRole("alert")).toHaveTextContent(
      "Write a message",
    );
    await expect(body.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Retain this draft.",
    );
  },
};
