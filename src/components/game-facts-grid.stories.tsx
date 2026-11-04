import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { AgeRatingFact } from "./game-facts";
import { GameFactsGrid } from "./game-facts-grid";

const meta = {
  title: "Product/Game facts grid",
  component: GameFactsGrid,
  args: {
    game: {
      criticScore: null,
      criticScoreCount: null,
      userScore: null,
      userScoreCount: null,
      languages: [],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Composes Fact and HoverFact for known Catalog values and compact definition-list metadata for unavailable facts. The regional age rating streams through the ageRating slot; this component never resolves a session.",
      },
    },
  },
} satisfies Meta<typeof GameFactsGrid>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Unavailable: Story = {};
export const PartialScores: Story = {
  args: {
    game: { ...meta.args.game, criticScore: 94.5, criticScoreCount: 1234 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("User score")).toBeVisible();
    await expect(
      canvas.getByText("Unavailable", { exact: true }),
    ).toBeVisible();
    await expect(canvas.getByText("95", { exact: true })).toBeVisible();
    await expect(canvas.getByText("1,234 reviews")).toBeVisible();
    await expect(
      canvas.queryByText("–", { exact: true }),
    ).not.toBeInTheDocument();
  },
};

export const UnavailableLight: Story = { globals: { theme: "light" } };
export const UserScoreOnly: Story = {
  args: { game: { ...meta.args.game, userScore: 0, userScoreCount: 1 } },
};
export const KnownScoreWithoutCount: Story = {
  args: { game: { ...meta.args.game, userScore: 82 } },
};
export const Full: Story = {
  args: {
    game: {
      criticScore: 94.5,
      criticScoreCount: 1234,
      userScore: 91.3,
      userScoreCount: 5678,
      languages: [
        { name: "English", voices: true, subtitles: true, interface: true },
      ],
    },
    ageRating: (
      <AgeRatingFact
        headline={{
          board: "ESRB",
          rating: "T",
          descriptors: ["Fantasy Violence"],
        }}
        others={[]}
      />
    ),
  },
};
export const FullLight: Story = { ...Full, globals: { theme: "light" } };
