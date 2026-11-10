import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import { ProfileVisibilityLoading } from "./content-loading";
import {
  ProfileVisibilityForm,
  ProfileVisibilitySection,
} from "./profile-visibility-form";

const meta = {
  title: "Product/Profile visibility",
  component: ProfileVisibilityForm,
  args: {
    current: "private",
    onSave: fn(async () => ({ saved: true as const })),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <ProfileVisibilitySection>
          <Story />
        </ProfileVisibilitySection>
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Profile visibility preferences with retained selection, local pending feedback, retry, and a confirmed check beside Save. Catalog callbacks do not save data.",
      },
    },
  },
} satisfies Meta<typeof ProfileVisibilityForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Save: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("group", { name: "Profile visibility" }),
    ).toHaveAccessibleDescription(/Notes always stay private/);
    await userEvent.click(canvas.getByRole("radio", { name: /^Public/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(canvas.getByRole("button", { name: "Save" })).toHaveFocus();
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("Saved"),
    );
    await userEvent.click(canvas.getByRole("radio", { name: /^Private/ }));
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
    await userEvent.click(canvas.getByRole("radio", { name: /^Public/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Please try again.",
    );
    await expect(canvas.getByRole("radio", { name: /^Public/ })).toBeChecked();
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
    await expect(canvas.getByRole("button", { name: "Save" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(canvas.getByRole("status")).toHaveTextContent("Saving…");
  },
};

export const Public: Story = { args: { current: "public" } };

export const Loading: Story = {
  render: () => <ProfileVisibilityLoading />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Profile visibility" }),
    ).toBeVisible();
    await expect(canvas.getByText(/Notes always stay private/)).toBeVisible();
    await expect(canvas.queryByRole("radio")).not.toBeInTheDocument();
  },
};
