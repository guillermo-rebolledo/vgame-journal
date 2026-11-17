import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { MainNav } from "./main-nav";

const meta = {
  title: "Product/Main navigation",
  component: MainNav,
  parameters: {
    nextjs: { navigation: { pathname: "/stats" } },
    docs: {
      description: {
        component:
          "The signed-in header exposes Find a game, Library, and Wishlist at every width. On phones the shared dropdown menu provides Lists and Stats and identifies the current destination.",
      },
    },
  },
} satisfies Meta<typeof MainNav>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Main" });
    const library = within(nav).getByRole("link", { name: "Library" });
    library.focus();
    await userEvent.tab();
    await expect(
      within(nav).getByRole("link", { name: "Wishlist" }),
    ).toHaveFocus();
  },
};

export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
