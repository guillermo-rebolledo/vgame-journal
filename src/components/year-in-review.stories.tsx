import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
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
  loggedByMonth: [3, 5, 9, 4, 2, 6, 7, 3, 4, 3, 1, 0],
  hours: 212.5,
  topPlatform: { name: "Nintendo Switch", games: 2 },
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
          "Owner-only seasonal recap, distinct from Stats charts: a ruled 4:5 sheet in Geist Mono with Keepsake Paper, Ink and Marker, beside the keepsake controls. Composes GameCover, Button, Checkbox and Label. Image preparation is deferred; the preview is the exact returned PNG, matching the sheet. Stories use a local placeholder image, never a production export handler. The sheet entrance runs once per mount and honors reduced motion. Pointer previews fade after image load, with a gentler reduced-motion fade; keyboard previews stay immediate.",
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
      loggedByMonth: Array(12).fill(0),
      hours: 0,
      topPlatform: null,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Every sheet cell says what is missing, and there is nothing to export.
    // The sheet fades in, so the first check waits for its entrance.
    await waitFor(() =>
      expect(canvas.getByText("No games added in 2026 yet.")).toBeVisible(),
    );
    await expect(
      canvas.getByText("No dated Playthroughs in 2026 yet."),
    ).toBeVisible();
    await expect(canvas.getByText("None yet")).toBeVisible();
    await expect(
      canvas.getByRole("heading", {
        name: "A year still waiting to be recorded",
      }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Preview PNG" }),
    ).toBeNull();
  },
};
export const PlayedOnly: Story = {
  args: {
    review: {
      ...review,
      logged: { count: 0, games: [] },
      loggedByMonth: Array(12).fill(0),
    },
  },
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
      played: { count: 1234, games },
      hours: 98765.4,
      topPlatform: { name: "Nintendo Entertainment System", games: 400 },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fits = (el: HTMLElement) => {
      const cell = el.closest(".review-tile > *");
      if (!cell) throw new Error("Not in a sheet cell");
      const box = cell.getBoundingClientRect();
      // Measure the glyphs: the element itself is a block as wide as its cell.
      const range = document.createRange();
      range.selectNodeContents(el);
      const text = range.getBoundingClientRect();
      return text.left >= box.left && text.right <= box.right;
    };
    // Counts shrink to stay inside their cell; hours round to whole numbers.
    await expect(fits(canvas.getByText("10,000", { exact: true }))).toBe(true);
    await expect(fits(canvas.getByText("98,765", { exact: true }))).toBe(true);
    await waitFor(() =>
      expect(
        canvas.getByRole("heading", { name: "1,234 games played" }),
      ).toBeVisible(),
    );
    await expect(canvas.getByRole("heading", { name: "2026" })).toBeVisible();
  },
};
export const PreviewAndUsername: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("checkbox")).not.toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: "Preview PNG" }));
    await waitFor(() =>
      expect(canvas.getByRole("img", { name: /PNG preview/ })).toBeVisible(),
    );
    await waitFor(() =>
      expect(canvas.getByRole("figure")).toHaveAttribute("data-ready", "true"),
    );
    await expect(args.onPrepare).toHaveBeenLastCalledWith(false, review.asOf);
    const checkbox = canvas.getByRole("checkbox");
    checkbox.focus();
    await userEvent.keyboard(" ");
    await expect(checkbox).toBeChecked();
    await expect(canvas.queryByRole("img", { name: /PNG preview/ })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Preview PNG" }));
    await waitFor(() =>
      expect(canvas.getByRole("img", { name: /for @player/ })).toBeVisible(),
    );
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
    await waitFor(() =>
      expect(canvas.getByRole("img", { name: /for @player/ })).toBeVisible(),
    );
    await expect(canvas.getByRole("checkbox")).toBeChecked();
  },
};

export const KeyboardPreview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("button", { name: "Preview PNG" }).focus();
    await userEvent.keyboard("{Enter}");
    const image = await canvas.findByRole("img", { name: /PNG preview/ });
    await expect(image).toBeVisible();
    await expect(canvas.getByRole("figure")).toHaveAttribute(
      "data-pointer-motion",
      "false",
    );
    await expect(
      canvas.getByRole("button", { name: "Download PNG" }),
    ).toBeEnabled();
  },
};

export const Downloading: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onAuthorizeDownload)?.mockImplementation(
      () => new Promise(() => {}),
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const preview = canvas.getByRole("button", { name: "Preview PNG" });
    await userEvent.click(preview);
    const download = await canvas.findByRole("button", {
      name: "Download PNG",
    });
    await userEvent.click(download);
    await expect(download).toHaveAttribute("aria-busy", "true");
    await expect(download.querySelector(".shimmer")).toHaveTextContent(
      "Download PNG",
    );
    await expect(
      download.querySelector('[data-slot="spinner"]'),
    ).toHaveAttribute("aria-hidden", "true");
    await expect(
      canvas.getByRole("button", { name: "Refresh preview" }),
    ).not.toHaveAttribute("aria-busy", "true");
    await expect(
      canvas.getByRole("status").querySelector(".shimmer"),
    ).toHaveTextContent("Preparing your download…");
  },
};
