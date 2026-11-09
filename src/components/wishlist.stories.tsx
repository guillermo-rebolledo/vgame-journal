import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { resolveRelease } from "@/lib/release-dates";
import { Wishlist } from "./wishlist";

const meta = {
  title: "Product/Wishlist",
  component: Wishlist,
  args: {
    entries: [
      {
        gameId: 1,
        title: "A game with an unannounced date",
        slug: "unannounced",
        coverImageId: null,
        release: resolveRelease([], "earliest"),
      },
      {
        gameId: 2,
        title: "A previously announced release",
        slug: "released",
        coverImageId: null,
        release: resolveRelease(
          [
            {
              region: "worldwide",
              date: new Date("2020-01-01"),
              precision: "day",
            },
          ],
          "earliest",
        ),
      },
    ],
    onMove: fn(async () => new Date("2026-11-09T12:00:00Z")),
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
  parameters: {
    nextjs: { navigation: { pathname: "/wishlist" } },
    docs: {
      description: {
        component:
          "Wishlist groups saved release information. Its existing notice composition explains failed or stale checks without changing unknown dates into provider errors. Status actions and retained move recovery stay available.",
      },
    },
  },
} satisfies Meta<typeof Wishlist>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentDates: Story = {};
export const DatesUnavailable: Story = {
  args: { releaseDatesUnavailable: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(
        canvas.getByText(/Release dates may be out of date/),
      ).toBeVisible(),
    );
    await expect(
      canvas.getByRole("heading", { name: "Release date not announced 1" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", {
        name: "Move A previously announced release to backlog",
      }),
    );
    await expect(args.onMove).toHaveBeenCalledWith(
      2,
      { status: "wishlist" },
      "backlog",
    );
    await waitFor(() =>
      expect(
        canvas.getByText(/Moved A previously announced release to Backlog/),
      ).toBeVisible(),
    );
    await waitFor(() =>
      expect(
        canvas.getByText(/Release dates may be out of date/),
      ).toBeVisible(),
    );
  },
};
export const Empty: Story = {
  args: { entries: [], releaseDatesUnavailable: true },
};
