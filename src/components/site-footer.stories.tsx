import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { SiteFooter } from "./site-footer";

const meta = {
  title: "Product/Site footer",
  component: SiteFooter,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Site-wide attribution and footer navigation. Composes SupportLink with privacy and creator GitHub links; MainNav is reserved for primary app destinations. Groups stack on phones and links wrap with generous spacing.",
      },
    },
  },
} satisfies Meta<typeof SiteFooter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const links = canvas.getAllByRole("link");
    for (const link of links) {
      await userEvent.tab();
      await expect(link).toHaveFocus();
    }
    await expect(canvas.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/guillermo-rebolledo",
    );
    await expect(
      canvas.getByRole("link", { name: "Privacy notice" }),
    ).toHaveAttribute("href", "/privacy");
  },
};
export const LightTheme: Story = { globals: { theme: "light" } };
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};
