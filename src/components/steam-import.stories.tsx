import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps } from "react";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import type { SteamReview, SteamReviewRow } from "@/lib/steam-import";
import { SteamImport } from "./steam-import";

const rows: SteamReviewRow[] = [
  "ready",
  "ready",
  "existing",
  "removed",
  "unmatched",
  "needs_look",
].map((state, i) => ({
  appid: i + 1,
  gameId: state === "unmatched" ? null : i + 1,
  name: [
    "Portal 2",
    "A very long game title with 日本語 and an edition that wraps on a narrow phone screen",
    "Played game",
    "Removed game",
    "Unknown game",
    "Bundle without a base game",
  ][i],
  playtime: 100 - i,
  lastPlayed: i,
  state: state as SteamReviewRow["state"],
}));
const meta = {
  title: "Product/Steam import",
  component: SteamImport,
  args: {
    connected: true,
    enabled: true,
    publicProfile: false,
    onRead: fn<() => Promise<SteamReview>>(async () => ({
      kind: "review" as const,
      rows,
    })),
    onCommit: fn<ComponentProps<typeof SteamImport>["onCommit"]>(async () => ({
      added: 1,
      feedbackInvitation: false,
    })),
    onDisconnect: fn(async () => ({ disconnected: true as const })),
  },
  beforeEach: ({ args }) => {
    mocked(args.onRead).mockReset().mockResolvedValue({ kind: "review", rows });
    mocked(args.onCommit)
      .mockReset()
      .mockResolvedValue({ added: 1, feedbackInvitation: false });
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Settings Steam connection and paged text review. Reuses Button, Checkbox, Select, PagedList, ActionFeedback, toast, and first-save feedback. No Steam data is persisted by catalog callbacks. The closest Settings composition is CalendarFeedForm; selection review has a distinct responsibility.",
      },
    },
  },
} satisfies Meta<typeof SteamImport>;
export default meta;
type Story = StoryObj<typeof meta>;
const start: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(
    within(canvasElement).getByRole("button", { name: "Start Steam import" }),
  );
  await waitFor(() =>
    expect(
      within(canvasElement).getByRole("button", { name: "Retry Steam import" }),
    ).toBeEnabled(),
  );
};
export const Connected: Story = {};
export const Disconnected: Story = { args: { connected: false } };
export const Unavailable: Story = {
  args: { enabled: false, connected: false },
};
export const Cancelled: Story = {
  args: { connected: false, connectionResult: "failed" },
};
export const Review: Story = {
  play: async (context) => {
    await start(context);
    const canvas = within(context.canvasElement);
    await expect(
      canvas
        .getAllByRole("checkbox")
        .filter((c) => c.getAttribute("aria-checked") === "true"),
    ).toHaveLength(2);
    await expect(
      canvas.getByRole("checkbox", { name: /Played game/ }),
    ).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Deselect all" }));
    await expect(
      canvas.getByRole("button", { name: "Add 0 to Backlog" }),
    ).toBeDisabled();
    const portal = canvas.getByRole("checkbox", { name: /Portal 2/ });
    await portal.focus();
    await userEvent.keyboard(" ");
    await expect(portal).toBeChecked();
    await userEvent.click(
      canvas.getByRole("button", { name: "Add 1 to Backlog" }),
    );
    await expect(context.args.onCommit).toHaveBeenCalledWith([1]);
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Start Steam import" }),
      ).toHaveFocus(),
    );
  },
};
export const PublicReview: Story = {
  args: { publicProfile: true },
  play: start,
};
export const LightReview: Story = { globals: { theme: "light" }, play: start };
export const Hidden: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onRead).mockResolvedValue({ kind: "hidden" });
  },
  play: start,
};
export const Empty: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onRead).mockResolvedValue({ kind: "empty" });
  },
  play: start,
};
export const TooMany: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onRead).mockResolvedValue({ kind: "too_many" });
  },
  play: start,
};
export const FailedRead: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onRead).mockResolvedValue({ kind: "unavailable" });
  },
  play: start,
};
export const Pending: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onRead).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ kind: "review", rows }), 200),
        ),
    );
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Start Steam import" }),
    );
  },
};
export const FailedCommit: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onCommit).mockResolvedValue({
      error: "Catalog unavailable. Retry in one minute.",
    });
  },
  play: async (context) => {
    await start(context);
    const canvas = within(context.canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Add 2 to Backlog" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Catalog unavailable",
    );
    await expect(
      canvas.getByRole("checkbox", { name: /Portal 2/ }),
    ).toBeChecked();
  },
};
export const TenThousand: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onRead).mockResolvedValue({
      kind: "review" as const,
      rows: Array.from({ length: 10_000 }, (_, i) => ({
        ...rows[0],
        appid: i + 1,
        gameId: i + 1,
        name: `Game ${i + 1}`,
      })),
    });
  },
  play: async (context) => {
    await start(context);
    const canvas = within(context.canvasElement);
    await expect(canvas.getAllByRole("checkbox")).toHaveLength(48);
    await userEvent.click(canvas.getByRole("button", { name: "Deselect all" }));
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(canvas.getAllByRole("checkbox")[0]).not.toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: "Select all" }));
    await expect(
      canvas.getByRole("button", { name: "Add 10000 to Backlog" }),
    ).toBeEnabled();
  },
};

export const RereadFailureKeepsSelection: Story = {
  beforeEach: ({ args }) => {
    mocked(args.onRead)
      .mockResolvedValueOnce({ kind: "review", rows })
      .mockResolvedValueOnce({ kind: "unavailable" });
  },
  play: async (context) => {
    await start(context);
    const canvas = within(context.canvasElement);
    await userEvent.click(canvas.getByRole("checkbox", { name: /Portal 2/ }));
    await userEvent.click(
      canvas.getByRole("button", { name: "Retry Steam import" }),
    );
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent(
        "Catalog is unavailable",
      ),
    );
    await expect(
      canvas.getByRole("checkbox", { name: /Portal 2/ }),
    ).not.toBeChecked();
    await expect(
      canvas.getByRole("button", { name: "Add 1 to Backlog" }),
    ).toBeEnabled();
  },
};
export const DisconnectReturnsFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Disconnect Steam" }),
    );
    await waitFor(() =>
      expect(
        canvas.getByRole("link", { name: "Sign in through Steam" }),
      ).toHaveFocus(),
    );
  },
};
