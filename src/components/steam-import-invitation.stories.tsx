import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { SteamImportInvitation } from "./steam-import-invitation";

const meta = {
  title: "Product/Steam import invitation",
  component: SteamImportInvitation,
  parameters: {
    docs: {
      description: {
        component:
          "Secondary action for an empty Journal on Home. Composes native links with shared Button styles; the server caller gates visibility with steamImportEnabled(). SteamConnection handles sign-in, while SteamImport owns game selection.",
      },
    },
  },
} satisfies Meta<typeof SteamImportInvitation>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", {
      name: "Import from Steam",
    });
    await expect(link).toHaveAttribute("href", "/settings/steam");
    await userEvent.tab();
    await expect(link).toHaveFocus();
  },
};
export const Light: Story = { ...Default, globals: { theme: "light" } };
