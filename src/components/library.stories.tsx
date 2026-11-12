import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { Library } from "./library";

const meta = {
  title: "Product/Library",
  component: Library,
  parameters: {
    docs: {
      description: {
        component:
          "Library reuses GameCover, PagedList and the shared filters. Empty owner views compose SteamImportInvitation only when the server enables Steam import; read-only public views never offer import. The persistent import action belongs to the owner page heading, outside these client-side filters.",
      },
    },
  },
  args: { entries: [], initialView: "grid", steamImportEnabled: true },
} satisfies Meta<typeof Library>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyWithSteam: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("link", { name: "Find a game" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Import from Steam" }),
    ).toHaveAttribute("href", "/settings/steam");
  },
};
export const EmptyWithoutSteam: Story = {
  args: { steamImportEnabled: false },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByText("Have games on Steam?"),
    ).not.toBeInTheDocument();
  },
};
export const PublicEmpty: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole("link", { name: "Import from Steam" }),
    ).not.toBeInTheDocument();
  },
};
export const Light: Story = { ...EmptyWithSteam, globals: { theme: "light" } };
