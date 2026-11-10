import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import type { YearInReview } from "@/lib/journal";
import { YearInReviewPage } from "./year-in-review";

const games = Array.from({ length: 12 }, (_, i) => ({
  gameId: i + 1,
  title:
    i === 0
      ? "A very long game title with 日本語 and a subtitle that wraps on a narrow screen"
      : `Game ${i + 1}`,
  slug: `game-${i + 1}`,
  coverImageId: null,
}));
const review: YearInReview = {
  year: 2026,
  asOf: "2026-12-15T12:00:00.000Z",
  through: "2026-12-15",
  inProgress: true,
  logged: { count: 47, games },
  played: { count: 3, games: games.slice(0, 3) },
};
const png = async () => (await fetch("/logo.png")).blob();
const meta = {
  title: "Product/Year in Review",
  component: YearInReviewPage,
  args: {
    review,
    username: "player",
    onPrepare: fn(png),
    onAuthorizeDownload: fn(async () => {}),
  },
  beforeEach: ({ args }) => {
    mocked(args.onPrepare)?.mockReset().mockImplementation(png);
    mocked(args.onAuthorizeDownload)?.mockReset().mockResolvedValue();
  },
  parameters: {
    docs: {
      description: {
        component:
          "Owner-only seasonal bento recap, distinct from Stats charts. Composes GameCover, Button, Checkbox and Label. Image preparation is deferred; the preview is the exact returned PNG. Stories use a local placeholder image, never a production export handler. The CSS tile entrance runs once per mount and honors reduced motion.",
      },
    },
  },
} satisfies Meta<typeof YearInReviewPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Truncated: Story = {};
export const LightTheme: Story = { globals: { theme: "light" } };
export const Empty: Story = {
  args: {
    review: {
      ...review,
      logged: { count: 0, games: [] },
      played: { count: 0, games: [] },
    },
  },
};
export const PlayedOnly: Story = {
  args: { review: { ...review, logged: { count: 0, games: [] } } },
};
export const OneGameMissingArt: Story = {
  args: {
    review: {
      ...review,
      logged: { count: 1, games: games.slice(0, 1) },
      played: { count: 0, games: [] },
    },
  },
};
export const FullYearLargeCount: Story = {
  args: {
    username: "a_very_long_username_1234567890",
    review: {
      ...review,
      asOf: "2026-12-31T23:59:59.999Z",
      through: "2026-12-31",
      inProgress: false,
      logged: { count: 10000, games },
    },
  },
};
export const PreviewAndUsername: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("checkbox")).not.toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: "Preview PNG" }));
    await expect(
      await canvas.findByRole("img", { name: /PNG preview/ }),
    ).toBeVisible();
    await expect(args.onPrepare).toHaveBeenLastCalledWith(false, review.asOf);
    const checkbox = canvas.getByRole("checkbox");
    checkbox.focus();
    await userEvent.keyboard(" ");
    await expect(checkbox).toBeChecked();
    await expect(canvas.queryByRole("img", { name: /PNG preview/ })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Preview PNG" }));
    await expect(
      await canvas.findByRole("img", { name: /for @player/ }),
    ).toBeVisible();
    await expect(args.onPrepare).toHaveBeenLastCalledWith(true, review.asOf);
  },
};
export const Preparing: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onPrepare)?.mockImplementation(() => new Promise(() => {}));
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Preview PNG" }));
    await expect(
      canvas.getByRole("button", { name: /Preview PNG/ }),
    ).toBeDisabled();
  },
};
export const FailureAndRetry: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onPrepare)
      ?.mockRejectedValueOnce(new Error("Unavailable"))
      .mockImplementation(png);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("checkbox"));
    await userEvent.click(canvas.getByRole("button", { name: "Preview PNG" }));
    await userEvent.click(
      await canvas.findByRole("button", { name: "Retry image" }),
    );
    await expect(
      await canvas.findByRole("img", { name: /for @player/ }),
    ).toBeVisible();
    await expect(canvas.getByRole("checkbox")).toBeChecked();
  },
};
