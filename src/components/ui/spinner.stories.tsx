import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { Spinner } from "./spinner";

const meta = {
  title: "UI/Spinner",
  component: Spinner,
  parameters: {
    docs: {
      description: {
        component:
          "Compass from loading.dev/spinners/compass (Jakub Krehel, MIT). Four ticks rotate 90° every 500ms. Adjacent loading text uses the installed shadcn shimmer utility with a visible 2s linear sweep from muted text to foreground, starting 500ms into the cycle so short operations show it immediately. Button labels preserve their surface color. Both stay static under reduced motion; forced colors restores plain text. Apply shimmer only while pending, inside the existing output/live region, or use Button loading. The SVG is decorative and creates no additional announcement. Skeleton reserves future content instead. No additional dependency. License: docs/licenses/loading-dev.md.",
      },
    },
  },
  render: (args) => (
    <output className="flex items-center gap-2 text-sm">
      <Spinner {...args} />
      <span className="shimmer">Searching the Catalog…</span>
    </output>
  ),
} satisfies Meta<typeof Spinner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("status");
    await expect(status).toHaveTextContent("Searching the Catalog…");
    await expect(status.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(status.querySelector(".shimmer")).toHaveTextContent(
      "Searching the Catalog…",
    );
  },
};
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Spinner className="size-3" />
      <Spinner />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
      <span className="sr-only">Loading…</span>
    </div>
  ),
};
export const LightTheme: Story = { globals: { theme: "light" } };
export const StaticPreview: Story = {
  args: { className: "[&_.compass-ticks]:animate-none" },
  render: (args) => (
    <output className="flex items-center gap-2 text-sm">
      <Spinner {...args} />
      <span className="shimmer shimmer-none animate-none">
        Searching the Catalog…
      </span>
    </output>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Preview of the stationary compass shown when the system requests reduced motion. The app uses the real prefers-reduced-motion media query.",
      },
    },
  },
};
export const LongStatus: Story = {
  render: () => (
    <output className="flex max-w-64 items-start gap-2 text-sm">
      <Spinner className="mt-0.5" />
      <span className="shimmer">
        Saving The Lantern Keeper and the Library Beyond the Last Horizon to
        Wishlist…
      </span>
    </output>
  ),
};
