import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { SteamConnection } from "./steam-connection";

const meta = {
  title: "Product/Steam connection",
  component: SteamConnection,
  args: {
    connected: true,
    enabled: true,
    onDisconnect: fn(async () => ({ disconnected: true as const })),
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
          "Settings entry for Steam: connection state, disconnect, and a link to the review page once connected and enabled. Game selection lives in SteamImport.",
      },
    },
  },
} satisfies Meta<typeof SteamConnection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};
export const Disconnected: Story = { args: { connected: false } };
export const Unavailable: Story = {
  args: { enabled: false, connected: false },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole("region"),
    ).not.toBeInTheDocument();
    await expect(
      within(canvasElement).queryByText("Steam import"),
    ).not.toBeInTheDocument();
  },
};
export const ConnectedWhileUnavailable: Story = {
  ...Unavailable,
  args: { enabled: false, connected: true },
};
export const Cancelled: Story = {
  args: { connected: false, connectionResult: "failed" },
};
export const DisconnectReturnsFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Disconnect Steam" }),
    );
    await waitFor(() =>
      expect(
        canvas.getByRole("link", { name: "Sign in through Steam" }),
      ).toHaveFocus(),
    );
  },
};
