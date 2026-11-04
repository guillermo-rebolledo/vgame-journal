import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor, within } from "storybook/test";
import type { HomeSnapshot } from "@/lib/home-journal";
import { DiscoveryContent } from "./discovery-content";
import { HomeCoverTransitions } from "./home-cover-link";
import { HomeCollections, HomeJournalProvider } from "./home-journal";

const titles = [
  "Star Fox",
  "The Legend of Zelda: Breath of the Wild",
  "A very long game title that wraps across several lines even on a wide screen",
  "Onimusha: Way of the Sword",
];
const initial: Promise<HomeSnapshot> = Promise.resolve({
  owner: "storybook-player",
  entries: titles.map((title, index) => ({
    gameId: index + 1,
    title,
    slug: `saved-${index}`,
    coverImageId: null,
    status: "playing",
    addedAt: new Date("2026-11-01"),
  })),
});

const meta = {
  title: "Product/Home shelves",
  component: HomeCollections,
  parameters: {
    docs: {
      description: {
        component:
          "HomeCollections and DiscoveryContent reuse HomeCoverLink and HomeSaveControls. Shared subgrid rows align complete titles, metadata and actions across neighboring cards. Compact personal shelves remain a list. Missing covers and local Journal actions keep this example offline.",
      },
    },
  },
  render: () => (
    <HomeCoverTransitions>
      <HomeJournalProvider owner="storybook-player" initial={initial}>
        <HomeCollections />
        <DiscoveryContent
          result={{
            shelves: [
              {
                key: "recent",
                refreshedAt: new Date("2026-11-03T12:00:00Z"),
                games: titles.map((title, index) => ({
                  id: index + 10,
                  title,
                  slug: `discovery-${index}`,
                  coverImageId: null,
                  year: index === 0 ? null : 2026,
                  platforms:
                    index === 0
                      ? []
                      : index === 1
                        ? ["PC"]
                        : ["PC", "Nintendo Switch", "PlayStation 5"],
                })),
              },
            ],
          }}
        />
      </HomeJournalProvider>
    </HomeCoverTransitions>
  ),
} satisfies Meta<typeof HomeCollections>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MixedTitleLengths: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("region", { name: "Playing" });
    for (const name of ["Playing", "Recently added", "Recently released"]) {
      const shelf = canvas.getByRole("region", { name });
      const cards = within(shelf).getAllByRole("listitem");
      await waitFor(async () => {
        const rows = new Map<number, HTMLElement[]>();
        for (const card of cards) {
          const top = Math.round(card.getBoundingClientRect().top);
          rows.set(top, [...(rows.get(top) ?? []), card]);
        }
        const aligned = [...rows.values()].every((row) => {
          const positions = row.map((card) => ({
            title: card.querySelector("a span")?.getBoundingClientRect().top,
            button: card.querySelector("button")?.getBoundingClientRect().top,
          }));
          return positions.every(
            (position) =>
              Math.abs((position.title ?? 0) - (positions[0].title ?? 0)) < 1 &&
              Math.abs((position.button ?? 0) - (positions[0].button ?? 0)) < 1,
          );
        });
        await expect(aligned).toBe(true);
      });
    }
  },
};
export const LightTheme: Story = {
  ...MixedTitleLengths,
  globals: { theme: "light" },
};
