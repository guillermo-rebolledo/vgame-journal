import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { HomeEntry, HomeSnapshot } from "@/lib/home-journal";
import {
  homeIntentGame,
  readHomeJournal,
  saveHomeStatus,
} from "../../.storybook/home-actions.mock";
import { HomeCoverTransitions } from "./home-cover-link";
import {
  HomeCollections,
  HomeJournalProvider,
  HomeSaveControls,
} from "./home-journal";
import { Button } from "./ui/button";

const celeste: HomeEntry = {
  gameId: 1,
  slug: "celeste",
  title: "Celeste",
  status: "backlog",
  coverImageId: null,
  addedAt: new Date("2026-11-01T00:00:00Z"),
};
const initial: Promise<HomeSnapshot> = Promise.resolve({
  owner: "storybook-player",
  entries: [celeste],
});

const meta = {
  title: "Product/Home Journal actions",
  component: HomeSaveControls,
  args: { game: celeste, presentation: "direct" },
  parameters: {
    docs: {
      description: {
        component:
          "HomeSaveControls extends the existing Home Journal provider with explicit Status actions. The caller owns game identity and navigation. Compact controls stay the default for shelves and Discovery. Unlike JournalStatus, these controls do not edit Completion tags or remove entries. Server actions use local catalog mocks; no Journal data is saved.",
      },
    },
  },
  beforeEach: () => {
    saveHomeStatus
      .mockReset()
      .mockImplementation(async (owner, gameId, slug, status) => ({
        snapshot: { owner, entries: [{ ...celeste, gameId, slug, status }] },
      }));
    readHomeJournal
      .mockReset()
      .mockResolvedValue({ owner: "storybook-player", entries: [celeste] });
    homeIntentGame.mockReset().mockResolvedValue(celeste);
  },
  render: (args) => (
    <HomeJournalProvider owner="storybook-player" initial={initial}>
      <HomeSaveControls {...args} />
    </HomeJournalProvider>
  ),
} satisfies Meta<typeof HomeSaveControls>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentStatusAndExplicitActions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const controls = within(
      await canvas.findByRole("group", { name: "Journal status" }),
    );
    await expect(controls.getByText("Current status: Backlog")).toBeVisible();
    for (const status of ["Backlog", "Wishlist", "Playing", "Played"]) {
      await expect(
        controls.getByRole("button", { name: `Save to ${status}` }),
      ).toBeEnabled();
    }
    await expect(saveHomeStatus).not.toHaveBeenCalled();
    await userEvent.tab();
    await expect(
      controls.getByRole("button", { name: "Save to Backlog" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        canvas
          .getByRole("button", { name: "Save to Backlog" })
          .querySelector("[data-action-state]"),
      ).toHaveAttribute("data-action-state", "success"),
    );
  },
};

export const PendingThenConfirmed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const controls = within(
      await canvas.findByRole("group", { name: "Journal status" }),
    );
    await controls.findByText("Current status: Backlog");
    let confirm!: (value: Awaited<ReturnType<typeof saveHomeStatus>>) => void;
    saveHomeStatus.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    );
    const playing = controls.getByRole("button", { name: "Save to Playing" });
    await userEvent.click(playing);
    await expect(
      canvas
        .getByRole("button", { name: "Save to Playing" })
        .querySelector("[data-action-state]"),
    ).toHaveAttribute("data-action-state", "pending");
    await expect(controls.getByText("Current status: Backlog")).toBeVisible();
    for (const button of controls.getAllByRole("button")) {
      await expect(button).toHaveAttribute("aria-disabled", "true");
    }
    await userEvent.click(
      controls.getByRole("button", { name: "Save to Wishlist" }),
    );
    await expect(saveHomeStatus).toHaveBeenCalledOnce();
    // Restore the useful action before the server confirms it.
    playing.focus();
    confirm({
      snapshot: {
        owner: "storybook-player",
        entries: [{ ...celeste, status: "playing" }],
      },
    });
    await controls.findByText("Current status: Playing");
    await waitFor(() =>
      expect(
        canvas
          .getByRole("button", { name: "Save to Playing" })
          .querySelector("[data-action-state]"),
      ).toHaveAttribute("data-action-state", "success"),
    );
    await expect(playing).toHaveFocus();
    await expect(canvas.getAllByRole("status")).toHaveLength(1);
    await expect(
      canvas.getByRole("status", { name: "Journal updates" }),
    ).toHaveTextContent("Celeste saved to Playing.");
    await expect(saveHomeStatus).toHaveBeenCalledWith(
      "storybook-player",
      1,
      "celeste",
      "playing",
    );
  },
};

export const ConfirmationSurvivesCatalogTitleRefresh: Story = {
  render: function RefreshedTitle(args) {
    const [title, setTitle] = useState(celeste.title);
    return (
      <HomeJournalProvider owner="storybook-player" initial={initial}>
        <HomeSaveControls {...args} game={{ ...args.game, title }} />
        <Button onClick={() => setTitle("Celeste: refreshed Catalog title")}>
          Refresh Catalog title
        </Button>
      </HomeJournalProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Current status: Backlog");
    await userEvent.click(
      canvas.getByRole("button", { name: "Save to Played" }),
    );
    await waitFor(() =>
      expect(
        canvas
          .getByRole("button", { name: "Save to Played" })
          .querySelector("[data-action-state]"),
      ).toHaveAttribute("data-action-state", "success"),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Refresh Catalog title" }),
    );
    await expect(
      canvas
        .getByRole("button", { name: "Save to Played" })
        .querySelector("[data-action-state]"),
    ).toHaveAttribute("data-action-state", "success");
    await expect(canvas.getByText("Current status: Played")).toBeVisible();
    await expect(
      canvas.getByRole("status", { name: "Journal updates" }),
    ).toHaveTextContent("Celeste saved to Played.");
  },
};

const otherPlayer: Promise<HomeSnapshot> = Promise.resolve({
  owner: "another-player",
  entries: [{ ...celeste, status: "played" }],
});
export const PendingSaveCannotConfirmForAnotherOwner: Story = {
  render: function AccountChange(args) {
    const [switched, setSwitched] = useState(false);
    return (
      <>
        <HomeJournalProvider
          owner={switched ? "another-player" : "storybook-player"}
          initial={switched ? otherPlayer : initial}
        >
          <HomeSaveControls {...args} />
        </HomeJournalProvider>
        <Button onClick={() => setSwitched(true)}>Switch account</Button>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    let finish!: (value: Awaited<ReturnType<typeof saveHomeStatus>>) => void;
    saveHomeStatus.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await canvas.findByText("Current status: Backlog");
    await userEvent.click(
      canvas.getByRole("button", { name: "Save to Played" }),
    );
    await waitFor(() =>
      expect(
        canvas
          .getByRole("button", { name: "Save to Played" })
          .querySelector("[data-action-state]"),
      ).toHaveAttribute("data-action-state", "pending"),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Switch account" }),
    );
    await canvas.findByText("Current status: Played");
    finish({
      snapshot: {
        owner: "storybook-player",
        entries: [{ ...celeste, status: "played" }],
      },
    });
    await userEvent.tab();
    await expect(canvas.getByText("Current status: Played")).toBeVisible();
    await expect(
      canvas.queryByText("Celeste saved to Played."),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("status", { name: "Journal updates" }),
    ).toBeEmptyDOMElement();
  },
};

const guest: Promise<HomeSnapshot> = Promise.resolve({
  owner: null,
  entries: [],
});
export const GuestPreservesRequestedStatus: Story = {
  render: (args) => (
    <HomeJournalProvider owner={null} initial={guest}>
      <HomeSaveControls {...args} />
    </HomeJournalProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Not in your Journal")).toBeVisible();
    await expect(
      canvas.getByText(/Sign in to save.*confirm.*signing in/),
    ).toBeVisible();
    const previous = window.location.href;
    try {
      window.history.replaceState(
        null,
        "",
        "/?q=Celeste&year=2018&platform=PC",
      );
      await userEvent.click(
        canvas.getByRole("button", { name: "Save to Wishlist" }),
      );
      const params = new URLSearchParams(window.location.search);
      await expect(Object.fromEntries(params)).toEqual({
        q: "Celeste",
        year: "2018",
        platform: "PC",
        saveGame: "1",
        saveSlug: "celeste",
        saveStatus: "wishlist",
      });
      await expect(saveHomeStatus).not.toHaveBeenCalled();
    } finally {
      window.history.replaceState(null, "", previous);
    }
  },
};

export const FailedSaveRetriesRequestedStatus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const controls = within(
      await canvas.findByRole("group", { name: "Journal status" }),
    );
    await controls.findByText("Current status: Backlog");
    let confirm!: (value: Awaited<ReturnType<typeof saveHomeStatus>>) => void;
    saveHomeStatus
      .mockResolvedValueOnce({
        snapshot: { owner: "storybook-player", entries: [celeste] },
        error: "Couldn’t confirm the save. Try again.",
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            confirm = resolve;
          }),
      );
    await userEvent.click(
      controls.getByRole("button", { name: "Save to Played" }),
    );
    const retry = await canvas.findByRole("button", {
      name: "Retry Celeste to Played",
    });
    await expect(controls.getByText("Current status: Backlog")).toBeVisible();
    await expect(
      canvas.queryByText("Celeste saved to Played."),
    ).not.toBeInTheDocument();
    await expect(
      controls.getByRole("button", { name: "Save to Played" }),
    ).toHaveAccessibleDescription(
      "Celeste: Couldn’t confirm the save. Try again.",
    );
    await userEvent.click(retry);
    await waitFor(() =>
      expect(
        canvas
          .getByRole("button", { name: "Save to Played" })
          .querySelector("[data-action-state]"),
      ).toHaveAttribute("data-action-state", "pending"),
    );
    await waitFor(() =>
      expect(
        controls.getByRole("button", { name: "Save to Played" }),
      ).toHaveFocus(),
    );
    confirm({
      snapshot: {
        owner: "storybook-player",
        entries: [{ ...celeste, status: "played" }],
      },
    });
    await controls.findByText("Current status: Played");
    await waitFor(() =>
      expect(
        controls.getByRole("button", { name: "Save to Played" }),
      ).toHaveFocus(),
    );
    await expect(
      canvas.queryByRole("button", { name: "Retry Celeste to Played" }),
    ).not.toBeInTheDocument();
    await expect(saveHomeStatus).toHaveBeenLastCalledWith(
      "storybook-player",
      1,
      "celeste",
      "played",
    );
  },
};

export const UnconfirmedSaveCanResavePreviousStatus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const controls = within(
      await canvas.findByRole("group", { name: "Journal status" }),
    );
    await controls.findByText("Current status: Backlog");
    // The remote save may have applied, but neither response nor reconciliation is available.
    saveHomeStatus
      .mockRejectedValueOnce(new Error("Connection interrupted"))
      .mockResolvedValueOnce({
        snapshot: { owner: "storybook-player", entries: [celeste] },
      });
    readHomeJournal.mockRejectedValueOnce(new Error("Offline"));
    await userEvent.click(
      controls.getByRole("button", { name: "Save to Playing" }),
    );
    await canvas.findByRole("button", { name: "Retry Celeste to Playing" });
    await expect(controls.getByText("Current status: Backlog")).toBeVisible();
    await expect(
      canvas.getByRole("status", { name: "Journal updates" }),
    ).toHaveTextContent("Celeste: save not confirmed.");
    await userEvent.click(
      controls.getByRole("button", { name: "Save to Backlog" }),
    );
    await waitFor(() => expect(saveHomeStatus).toHaveBeenCalledTimes(2));
    await expect(saveHomeStatus).toHaveBeenLastCalledWith(
      "storybook-player",
      1,
      "celeste",
      "backlog",
    );
    await waitFor(() =>
      expect(
        canvas
          .getByRole("button", { name: "Save to Backlog" })
          .querySelector("[data-action-state]"),
      ).toHaveAttribute("data-action-state", "success"),
    );
  },
};

export const UnavailableJournalRecovery: Story = {
  render: (args) => (
    <HomeJournalProvider owner="storybook-player" initial={unavailable}>
      <HomeSaveControls {...args} />
    </HomeJournalProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Journal status unavailable.");
    const save = canvas.getByRole("button", { name: "Save to Played" });
    await expect(save).toHaveAttribute("aria-disabled", "true");
    await expect(
      canvas.queryByText("Not in your Journal"),
    ).not.toBeInTheDocument();
    await userEvent.click(save);
    await expect(saveHomeStatus).not.toHaveBeenCalled();
    readHomeJournal.mockResolvedValueOnce({
      owner: "storybook-player",
      entries: [celeste],
    });
    await userEvent.click(
      canvas.getByRole("button", { name: "Retry Journal for Celeste" }),
    );
    await canvas.findByText("Current status: Backlog");
    await expect(save).toHaveAttribute("aria-disabled", "false");
  },
};
const unavailable: Promise<HomeSnapshot> = Promise.resolve({
  owner: "storybook-player",
  entries: null,
});

export const SessionChangeRequiresSignIn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Current status: Backlog");
    const previous = window.location.href;
    try {
      window.history.replaceState(null, "", "/?q=Celeste&year=2018");
      saveHomeStatus.mockResolvedValueOnce({
        snapshot: { owner: null, entries: null },
        authRequired: true,
      });
      await userEvent.click(
        canvas.getByRole("button", { name: "Save to Wishlist" }),
      );
      const signIn = await canvas.findByRole("link", {
        name: "Sign in to save Celeste",
      });
      await expect(canvas.getByText(/Your session changed/)).toBeVisible();
      await expect(
        canvas.queryByText("Celeste saved to Wishlist."),
      ).not.toBeInTheDocument();
      const href = new URL(
        signIn.getAttribute("href") ?? "",
        window.location.origin,
      );
      const returnTo = new URL(
        href.searchParams.get("returnTo") ?? "",
        window.location.origin,
      );
      await expect(Object.fromEntries(returnTo.searchParams)).toEqual({
        q: "Celeste",
        year: "2018",
        saveGame: "1",
        saveSlug: "celeste",
        saveStatus: "wishlist",
      });
    } finally {
      window.history.replaceState(null, "", previous);
    }
  },
};

export const SynchronizesCompactControlsAndCounts: Story = {
  render: (args) => (
    <HomeCoverTransitions>
      <HomeJournalProvider owner="storybook-player" initial={initial}>
        <section aria-label="Selected game">
          <HomeSaveControls {...args} />
        </section>
        <section aria-label="Another occurrence">
          <HomeSaveControls game={celeste} />
        </section>
        <HomeCollections />
      </HomeJournalProvider>
    </HomeCoverTransitions>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("link", { name: "Backlog (1)" });
    saveHomeStatus.mockResolvedValueOnce({
      snapshot: {
        owner: "storybook-player",
        entries: [{ ...celeste, status: "wishlist" }],
      },
    });
    await userEvent.click(
      canvas.getByRole("button", { name: "Save to Wishlist" }),
    );
    await canvas.findByRole("link", { name: "Wishlist (1)" });
    await expect(
      canvas.getByRole("link", { name: "Backlog (0)" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "All saved games (1)" }),
    ).toBeVisible();
    await expect(
      within(
        canvas.getByRole("region", { name: "Another occurrence" }),
      ).getByText("Wishlisted"),
    ).toBeVisible();
    await expect(canvas.getAllByRole("status")).toHaveLength(1);
  },
};

export const CompactDefault: Story = {
  args: { presentation: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("button", { name: "Change status for Celeste" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Save to Backlog" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Change status for Celeste" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await body.findByRole("menuitemradio", { name: "Backlog" }),
    ).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Change status for Celeste" }),
      ).toHaveFocus(),
    );
  },
};

export const LightTheme: Story = {
  ...CurrentStatusAndExplicitActions,
  globals: { theme: "light" },
};

export const LongTitlePending: Story = {
  args: {
    game: {
      ...celeste,
      title:
        "日本語のゲーム — مغامرة طويلة 2026 — ALongUnbrokenGameTitleThatMustWrapWithoutPushingTheControlsOutsideTheDialog",
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Current status: Backlog");
    saveHomeStatus.mockImplementationOnce(() => new Promise(() => {}));
    await userEvent.click(
      canvas.getByRole("button", { name: "Save to Played" }),
    );
    await expect(
      canvas
        .getByRole("button", { name: "Save to Played" })
        .querySelector("[data-action-state]"),
    ).toHaveAttribute("data-action-state", "pending");
    await expect(
      canvas.getByRole("status", { name: "Journal updates" }),
    ).toHaveTextContent(`Saving ${args.game.title} to Played…`);
  },
};

const unresolvedJournal = new Promise<HomeSnapshot>(() => {});
export const LoadingPersonalShelves: Story = {
  render: () => (
    <HomeJournalProvider owner="storybook-player" initial={unresolvedJournal}>
      <HomeCollections />
    </HomeJournalProvider>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Checking Journal status…"),
    ).toBeInTheDocument();
    await expect(
      canvasElement.querySelector('[data-slot="skeleton"]'),
    ).toBeVisible();
    await expect(
      within(canvasElement).queryByText("No games yet"),
    ).not.toBeInTheDocument();
  },
};
