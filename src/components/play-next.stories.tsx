import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type {
  PlayNextGame,
  PlayNextRead,
  PlayNextSave,
  PlayNextSnapshot,
} from "@/lib/play-next";
import { PlayNext } from "./play-next";

const games: PlayNextGame[] = Array.from({ length: 7 }, (_, i) => ({
  id: i + 1,
  title:
    i === 0
      ? "A Very Long Game Title That Wraps Across the Shelf Without Losing Its Actions"
      : `Shelf game ${i + 1}`,
  slug: `shelf-${i + 1}`,
  coverImageId: null,
  genres: i ? ["Adventure"] : [],
  platforms: ["PC"],
  year: i ? 2020 : null,
  reason: "You saved this to your Backlog.",
  series: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
}));
const read: PlayNextRead = async (owner, request) => ({
  owner,
  source: request.source ?? "backlog",
  provenance: request.source === "discover" ? "popular" : "backlog",
  backlogCount: 7,
  games: request.platform && request.platform !== "PC" ? [] : games,
  bounded: false,
  platforms: ["PC"],
  genres: ["Adventure"],
});
const meta = {
  title: "Product/Play next",
  component: PlayNext,
  args: {
    owner: "story-owner",
    onRead: read,
    onSave: (async () => ({})) as PlayNextSave,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Three equal Shelf suggestions; compact cover-and-text rows on phones. Uses GameCover, Button, Field, Select and Drawer. Library is the closest filter composition, Discovery the closest cover composition; this owns private rounds and explicit choice confirmation. No live server actions in stories.",
      },
    },
  },
} satisfies Meta<typeof PlayNext>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Shelf: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getAllByRole("article")).toHaveLength(3));
    const choose = canvas.getAllByRole("button", { name: /^Choose this/ })[0];
    await userEvent.click(choose);
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole("dialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(choose).toHaveFocus();
    await userEvent.click(
      canvas.getByRole("button", { name: "Show different games" }),
    );
    await expect(
      canvas.queryByRole("article", { name: games[0].title }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Show different games" }),
    );
    await expect(canvas.getAllByRole("article")).toHaveLength(1);
    await userEvent.click(
      canvas.getByRole("button", { name: "Reshuffle games" }),
    );
    await expect(canvas.getAllByRole("article")).toHaveLength(3);
  },
};
export const Start: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", {
        name: `Choose this for ${games[0].title}`,
      }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByRole("button", { name: "Set Status to Playing" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: games[0].title }),
    ).toHaveFocus();
    await userEvent.click(
      canvas.getByRole("button", { name: "Back to suggestions" }),
    );
    await expect(
      canvas.queryByRole("article", { name: games[0].title }),
    ).not.toBeInTheDocument();
  },
};
export const DiscoverAndSaveAll: Story = {
  args: {
    onRead: async (owner, request) => ({
      ...(await read(owner, request)),
      source: "discover",
      provenance: "popular",
      games: games.slice(0, 3),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const game of games.slice(0, 3))
      await userEvent.click(
        await canvas.findByRole("button", {
          name: `Save to Backlog for ${game.title}`,
        }),
      );
    await expect(
      canvas.getByRole("heading", { name: "You’ve seen every match" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Reload suggestions" }),
    ).toBeEnabled();
  },
};
export const EmptyBacklog: Story = {
  args: {
    onRead: async (owner, request) => ({
      ...(await read(owner, request)),
      source: request.source ?? "discover",
      provenance: "popular",
      backlogCount: 0,
      games: request.source === "backlog" ? [] : games,
    }),
  },
};
export const Partial: Story = {
  args: {
    onRead: async (owner, request) => ({
      ...(await read(owner, request)),
      games: games.slice(0, 2),
    }),
  },
};
export const NoMatches: Story = {
  args: {
    onRead: async (owner, request) => ({
      ...(await read(owner, request)),
      games: [],
    }),
  },
};
export const ErrorAndRetry: Story = {
  render: (args) => {
    let attempts = 0;
    const retryRead: PlayNextRead = async (owner, request) => {
      if (++attempts === 1) throw new Error("offline");
      return read(owner, request);
    };
    return <PlayNext {...args} onRead={retryRead} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(canvas.getAllByRole("article")).toHaveLength(3));
  },
};
export const SaveFailure: Story = {
  args: {
    onSave: async () => ({
      error: "Couldn’t save. Your choice is kept; try again.",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", {
        name: `Choose this for ${games[0].title}`,
      }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByRole("button", { name: "Set Status to Playing" }),
    );
    await expect(await body.findByRole("alert")).toHaveTextContent(
      "Couldn’t save. Your choice is kept; try again.",
    );
    await expect(
      body.getByRole("button", { name: "Set Status to Playing" }),
    ).toBeEnabled();
  },
};
export const Pending: Story = {
  args: { onSave: () => new Promise(() => {}) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", {
        name: `Choose this for ${games[0].title}`,
      }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const start = await body.findByRole("button", {
      name: "Set Status to Playing",
    });
    await userEvent.click(start);
    await expect(start).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await expect(body.getByRole("dialog")).toBeVisible();
  },
};
export const Loading: Story = {
  args: { onRead: () => new Promise<PlayNextSnapshot>(() => {}) },
};
export const Light: Story = { globals: { theme: "light" } };
export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

export const PopularFallbackKeepsRound: Story = {
  args: {
    onRead: async (owner, request) => ({
      ...(await read(owner, request)),
      source: "discover",
      provenance: request.popular ? "popular" : "related",
      games: request.popular ? games : games.slice(0, 3),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Show popular games" }),
    );
    await waitFor(() =>
      expect(
        canvas.getByRole("heading", { name: "Popular games" }),
      ).toBeVisible(),
    );
    for (const game of games.slice(0, 3))
      await expect(
        canvas.queryByRole("article", { name: game.title }),
      ).not.toBeInTheDocument();
    await expect(canvas.getAllByRole("article")).toHaveLength(3);
  },
};
