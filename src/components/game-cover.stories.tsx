import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GameCover } from "./game-cover";

const meta = {
  title: "Product/Game cover",
  component: GameCover,
  args: { imageId: null, className: "w-44 rounded-lg" },
  render: (args) => (
    <a
      href="#game"
      className="flex w-fit flex-col gap-2 rounded-lg outline-offset-4 focus-visible:outline-2"
    >
      <GameCover {...args} />
      <span className="text-sm">Game without cover art</span>
    </a>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Decorative cover art with a neutral 10% inset outline following its radius, a 264:374 ratio and missing-art fallback. The adjacent title supplies the accessible link name. These examples use missing art to stay deterministic and offline; imageId can be edited to preview a real IGDB cover. Source: src/components/game-cover.tsx.",
      },
    },
  },
} satisfies Meta<typeof GameCover>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MissingArt: Story = {};
export const Compact: Story = {
  args: { size: "cover_small", className: "w-12 rounded" },
};
export const LightTheme: Story = { globals: { theme: "light" } };
