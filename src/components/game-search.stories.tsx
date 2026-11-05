import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useSearchParams } from "@storybook/nextjs-vite/navigation.mock";
import { ReadonlyURLSearchParams } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { SearchResult } from "@/lib/catalog";
import { saveHomeStatus } from "../../.storybook/home-actions.mock";
import { GameSearch } from "./game-search";
import { HomeCoverTransitions } from "./home-cover-link";
import { HomeCollections, HomeJournalProvider } from "./home-journal";
import { HomeSearch } from "./home-search";
import { ListEditorDrawer } from "./list-creation-drawer";
import { Button } from "./ui/button";

const games: SearchResult[] = Array.from({ length: 25 }, (_, index) => ({
  id: index + 1,
  title:
    [
      "Celeste",
      "The Legend of Zelda: A very long title that wraps without losing its identity",
      "冒険の記録 2026 — مغامرة 42",
      "OneUnbrokenGameTitleThatMustWrapEvenOnTheSmallestPhoneWithoutHorizontalScrolling",
    ][index] ?? `Catalog game ${index + 1}`,
  slug: `catalog-game-${index + 1}`,
  coverImageId: null,
  year: index === 2 ? null : index % 2 ? 2024 : 2018,
  platforms:
    index === 2
      ? []
      : ["PC", "Nintendo Switch", "Super Nintendo Entertainment System"],
}));
const added = fn();

const meta = {
  title: "Product/Game search",
  component: GameSearch,
  args: {
    guidance: "Search the Catalog, then choose a game to see its actions.",
    renderAction: (game) => (
      <Button className="min-h-11" onClick={() => added(game.id)}>
        Add to list
      </Button>
    ),
  },
  parameters: {
    docs: {
      description: {
        component:
          "GameSearch composes Base UI Dialog and inline Combobox with the existing Input, Button, GameCover, metadata, HomeCoverLink and Journal action renderer. Standalone search owns its centered modal; embedded search reuses an editor's shell, focus ref and viewport observer. Real Catalog requests and URL behavior remain at this boundary; stories replace only browser navigation and the HTTP boundary.",
      },
    },
  },
  beforeEach: ({ parameters }) => {
    const originalUrl = window.location.href;
    const originalReplace = window.history.replaceState.bind(window.history);
    const url = new URL(originalUrl);
    for (const key of ["q", "year", "platform", "filters", "all", "saveGame"])
      url.searchParams.delete(key);
    originalReplace(null, "", url);
    window.history.replaceState = (...args) => {
      originalReplace(...args);
      window.dispatchEvent(new PopStateEvent("popstate"));
    };
    useSearchParams.mockImplementation(function useHistoryParams() {
      const search = useSyncExternalStore(
        (notify) => {
          window.addEventListener("popstate", notify);
          return () => window.removeEventListener("popstate", notify);
        },
        () => window.location.search,
      );
      return new ReadonlyURLSearchParams(search);
    });
    const originalFetch = window.fetch;
    let attempt = 0;
    window.fetch = async (input, init) => {
      if (!String(input).startsWith("/api/games/search"))
        return originalFetch(input, init);
      attempt++;
      if (parameters.catalog === "loading")
        return new Promise<Response>(() => {});
      if (parameters.catalog === "retry" && attempt === 1)
        return new Response("", { status: 503 });
      return Response.json(parameters.catalog === "empty" ? [] : games);
    };
    added.mockClear();
    return () => {
      window.fetch = originalFetch;
      window.history.replaceState = originalReplace;
      originalReplace(null, "", originalUrl);
      useSearchParams.mockReset();
    };
  },
} satisfies Meta<typeof GameSearch>;
export default meta;
type Story = StoryObj<typeof meta>;

const open = async (canvasElement: HTMLElement) => {
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(
    within(canvasElement).getByRole("button", { name: "Search games…" }),
  );
  const input = await body.findByRole("combobox", { name: "Search games" });
  await waitFor(() => expect(input).toHaveFocus());
  await expect(input).toHaveAttribute(
    "aria-controls",
    body.getByRole("listbox", { name: "Search results" }).id,
  );
  return { body, input };
};

export const OpenAndDismiss: Story = {
  play: async ({ canvasElement }) => {
    const { body, input } = await open(canvasElement);
    await userEvent.tab({ shift: true });
    await expect(
      body.getByRole("button", { name: "Close search" }),
    ).toHaveFocus();
    await userEvent.tab();
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(
      within(canvasElement).getByRole("button", { name: "Search games…" }),
    ).toHaveFocus();
  },
};

export const ResultsAndActions: Story = {
  play: async ({ canvasElement }) => {
    const { body, input } = await open(canvasElement);
    await userEvent.type(input, "game");
    await body.findByRole("option", { name: /^Celeste / });
    const list = body.getByRole("listbox", { name: "Search results" });
    await expect(within(list).getAllByRole("option")).toHaveLength(25);
    await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    await userEvent.keyboard(
      "{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}",
    );
    const active = input.getAttribute("aria-activedescendant");
    const scroll = list.scrollTop;
    await expect(scroll).toBeGreaterThan(0);
    await userEvent.keyboard("{Enter}");
    const back = body.getByRole("button", { name: "Back to results" });
    await expect(back).toHaveFocus();
    await expect(added).not.toHaveBeenCalled();
    await expect(body.getByRole("link", { name: /View game/ })).toHaveAttribute(
      "href",
      "/games/catalog-game-9",
    );
    await userEvent.click(body.getByRole("button", { name: "Add to list" }));
    await expect(added).toHaveBeenCalledOnce();
    await userEvent.click(back);
    await waitFor(() => expect(input).toHaveFocus());
    await expect(input).toHaveValue("game");
    await expect(input).toHaveAttribute("aria-activedescendant", active);
    await expect(list.scrollTop).toBe(scroll);
    await userEvent.keyboard("{Enter}");
    await userEvent.click(body.getByRole("button", { name: "Close search" }));
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Search games…" }),
    );
    await expect(
      body.queryByRole("button", { name: "Back to results" }),
    ).not.toBeInTheDocument();
    await expect(
      body.getByRole("combobox", { name: "Search games" }),
    ).toHaveValue("game");
    await userEvent.clear(body.getByRole("combobox", { name: "Search games" }));
    await expect(
      body.queryByText("Scroll to browse all returned matches."),
    ).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: { catalog: "loading" },
  play: async ({ canvasElement }) => {
    const { body, input } = await open(canvasElement);
    await userEvent.type(input, "game");
    await expect(body.getByRole("listbox")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(input).toHaveAttribute(
      "aria-controls",
      body.getByRole("listbox").id,
    );
    await expect(body.queryByRole("option")).not.toBeInTheDocument();
    await expect(
      body.getByRole("status", { name: "Search updates" }),
    ).toHaveTextContent("Searching…");
    await expect(
      body
        .getByRole("status", { name: "Search updates" })
        .querySelector('[data-slot="spinner"]'),
    ).toBeVisible();
  },
};
export const Empty: Story = {
  parameters: { catalog: "empty" },
  play: async ({ canvasElement }) => {
    const { body, input } = await open(canvasElement);
    await userEvent.type(input, "missing");
    await waitFor(() =>
      expect(
        body.getByRole("status", { name: "Search updates" }),
      ).toHaveTextContent("No matches returned for “missing”."),
    );
    await expect(input).toHaveAttribute(
      "aria-controls",
      body.getByRole("listbox").id,
    );
    await expect(body.queryByRole("option")).not.toBeInTheDocument();
  },
};
export const FailureAndRetry: Story = {
  parameters: { catalog: "retry" },
  play: async ({ canvasElement }) => {
    const { body, input } = await open(canvasElement);
    await userEvent.type(input, "game");
    await body.findByRole("alert");
    await expect(input).toHaveValue("game");
    await expect(input).toHaveAttribute(
      "aria-controls",
      body.getByRole("listbox").id,
    );
    await expect(body.queryByRole("option")).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "Try again" }));
    await body.findByRole("option", { name: /^Celeste / });
    await expect(body.queryByRole("alert")).not.toBeInTheDocument();
  },
};
export const LongTitlesAndUnknownMetadata: Story = {
  play: async ({ canvasElement }) => {
    const { body, input } = await open(canvasElement);
    await userEvent.type(input, "game");
    await body.findByRole("option", { name: /^Celeste / });
    await expect(body.getByText("Year unavailable")).toBeVisible();
    await expect(body.getByText("Platform availability unknown")).toBeVisible();
    await userEvent.click(
      body.getByRole("option", { name: new RegExp(games[2].title) }),
    );
    await expect(body.getByText("No cover art")).toBeVisible();
  },
};
export const LightTheme: Story = {
  ...LongTitlesAndUnknownMetadata,
  globals: { theme: "light" },
};

export const EmbeddedListActions: Story = {
  render: function Editor(args) {
    const [open, setOpen] = useState(true);
    const [member, setMember] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    return (
      <ListEditorDrawer
        open={open}
        pending={false}
        onOpenChange={setOpen}
        title="Add games"
        description="Search the Catalog for games to add to your list."
        initialFocus={input}
        finalFocus={false}
      >
        <GameSearch
          {...args}
          presentation="embedded"
          inputRef={input}
          renderAction={() => (
            <Button
              disabled={member}
              className="min-h-11"
              onClick={() => setMember(true)}
            >
              {member ? "Already in list" : "Add to list"}
            </Button>
          )}
        />
      </ListEditorDrawer>
    );
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getAllByRole("dialog")).toHaveLength(1);
    const input = body.getByRole("combobox", { name: "Search games" });
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.type(input, "game");
    await userEvent.click(
      await body.findByRole("option", { name: /^Celeste / }),
    );
    await userEvent.click(body.getByRole("button", { name: "Add to list" }));
    await expect(
      body.getByRole("button", { name: "Already in list" }),
    ).toBeDisabled();
    await userEvent.click(
      body.getByRole("button", { name: "Back to results" }),
    );
    await expect(input).toHaveValue("game");
    await expect(body.getAllByRole("dialog")).toHaveLength(1);
  },
};

export const SoftwareKeyboardViewport: Story = {
  play: async ({ canvasElement }) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      window,
      "visualViewport",
    );
    const viewport = Object.assign(new EventTarget(), {
      height: 320,
      offsetTop: 90,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    try {
      const { body, input } = await open(canvasElement);
      const dialog = body.getByRole("dialog");
      await waitFor(() => {
        const rect = dialog.getBoundingClientRect();
        expect(rect.top).toBeGreaterThanOrEqual(90);
        expect(rect.bottom).toBeLessThanOrEqual(410);
      });
      viewport.height = 210;
      viewport.offsetTop = 40;
      window.dispatchEvent(new Event("orientationchange"));
      await waitFor(() => {
        const rect = dialog.getBoundingClientRect();
        expect(rect.top).toBeGreaterThanOrEqual(40);
        expect(rect.bottom).toBeLessThanOrEqual(250);
      });
      await expect(input).toBeVisible();
      await expect(
        body.getByRole("button", { name: "Close search" }),
      ).toBeVisible();
      await userEvent.click(body.getByRole("button", { name: "Close search" }));
    } finally {
      if (descriptor)
        Object.defineProperty(window, "visualViewport", descriptor);
      else Reflect.deleteProperty(window, "visualViewport");
    }
  },
};

const journal: Promise<import("@/lib/home-journal").HomeSnapshot> =
  Promise.resolve({ owner: "search-player", entries: [] });
export const ConfirmedHomeSaveIsScopedToActiveStage: Story = {
  render: () => (
    <HomeJournalProvider owner="search-player" initial={journal}>
      <HomeSearch guidance="Search the Catalog, then choose a Journal Status." />
    </HomeJournalProvider>
  ),
  play: async ({ canvasElement }) => {
    saveHomeStatus
      .mockReset()
      .mockImplementation(async (owner, gameId, slug, status) => ({
        snapshot: {
          owner,
          entries: [
            {
              gameId,
              slug,
              title: "Celeste",
              status,
              coverImageId: null,
              addedAt: new Date("2026-11-01"),
            },
          ],
        },
      }));
    const body = within(canvasElement.ownerDocument.body);
    const { input } = await open(canvasElement);
    await userEvent.type(input, "games");
    await userEvent.click(
      await body.findByRole("option", { name: /^Celeste/ }),
    );
    await expect(saveHomeStatus).not.toHaveBeenCalled();
    await userEvent.click(body.getByRole("button", { name: "Save to Played" }));
    await expect(await body.findByText("Current status: Played")).toBeVisible();
    const updates = body.getByRole("status", { name: "Journal updates" });
    await waitFor(() =>
      expect(updates).toHaveTextContent("Celeste saved to Played."),
    );
    await expect(
      body.getAllByRole("status", { name: "Journal updates" }),
    ).toHaveLength(1);
    await userEvent.click(
      body.getByRole("button", { name: "Back to results" }),
    );
    await userEvent.click(body.getByRole("option", { name: /^The Legend/ }));
    await expect(
      body.getByRole("status", { name: "Journal updates" }),
    ).toBeEmptyDOMElement();
    await expect(
      body.queryByText("Celeste saved to Played."),
    ).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "Close search" }));
    await open(canvasElement);
    await userEvent.click(body.getByRole("option", { name: /^Celeste/ }));
    await expect(body.getByText("Current status: Played")).toBeVisible();
    await expect(
      body.getByRole("status", { name: "Journal updates" }),
    ).toBeEmptyDOMElement();
    await expect(
      body.queryByText("Celeste saved to Played."),
    ).not.toBeInTheDocument();
  },
};

export const LateSaveCannotAnnounceForAnotherGame: Story = {
  render: ConfirmedHomeSaveIsScopedToActiveStage.render,
  play: async ({ canvasElement }) => {
    let finishFirst!: (
      value: Awaited<ReturnType<typeof saveHomeStatus>>,
    ) => void;
    let finishSecond!: (
      value: Awaited<ReturnType<typeof saveHomeStatus>>,
    ) => void;
    saveHomeStatus
      .mockReset()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSecond = resolve;
          }),
      );
    const { body, input } = await open(canvasElement);
    await userEvent.type(input, "games");
    await userEvent.click(
      await body.findByRole("option", { name: /^Celeste/ }),
    );
    await userEvent.click(
      body.getByRole("button", { name: "Save to Backlog" }),
    );
    await userEvent.click(
      body.getByRole("button", { name: "Back to results" }),
    );
    await userEvent.click(body.getByRole("option", { name: /^The Legend/ }));
    await userEvent.click(
      body.getByRole("button", { name: "Save to Wishlist" }),
    );
    const entry = (index: number, status: "backlog" | "wishlist") => ({
      ...games[index],
      gameId: games[index].id,
      status,
      addedAt: new Date("2026-11-01"),
    });
    finishFirst({
      snapshot: { owner: "search-player", entries: [entry(0, "backlog")] },
    });
    await waitFor(() =>
      expect(
        body.getByRole("status", { name: "Journal updates" }),
      ).toHaveTextContent(`Saving ${games[1].title} to Wishlist…`),
    );
    await expect(
      body.getByRole("status", { name: "Journal updates" }),
    ).not.toHaveTextContent("Celeste");
    finishSecond({
      snapshot: {
        owner: "search-player",
        entries: [entry(0, "backlog"), entry(1, "wishlist")],
      },
    });
    await waitFor(() =>
      expect(
        body.getByRole("status", { name: "Journal updates" }),
      ).toHaveTextContent(`${games[1].title} saved to Wishlist.`),
    );
    await expect(
      body.getAllByRole("status", { name: "Journal updates" }),
    ).toHaveLength(1);
  },
};

export const ConfirmedSecondSaveSurvivesLateFirstSave: Story = {
  render: () => (
    <HomeCoverTransitions>
      <HomeJournalProvider owner="search-player" initial={journal}>
        <HomeSearch guidance="Search the Catalog, then choose a Journal Status." />
        <HomeCollections />
      </HomeJournalProvider>
    </HomeCoverTransitions>
  ),
  play: async ({ canvasElement }) => {
    let finishFirst!: (
      value: Awaited<ReturnType<typeof saveHomeStatus>>,
    ) => void;
    saveHomeStatus
      .mockReset()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({
        snapshot: {
          owner: "search-player",
          entries: [
            {
              ...games[1],
              gameId: games[1].id,
              status: "wishlist",
              addedAt: new Date("2026-11-01"),
            },
          ],
        },
      });
    const { body, input } = await open(canvasElement);
    await userEvent.type(input, "games");
    await userEvent.click(
      await body.findByRole("option", { name: /^Celeste/ }),
    );
    await userEvent.click(
      body.getByRole("button", { name: "Save to Backlog" }),
    );
    await userEvent.click(
      body.getByRole("button", { name: "Back to results" }),
    );
    await userEvent.click(body.getByRole("option", { name: /^The Legend/ }));
    await userEvent.click(
      body.getByRole("button", { name: "Save to Wishlist" }),
    );
    const confirmation = `${games[1].title} saved to Wishlist.`;
    await waitFor(() =>
      expect(
        body
          .getByRole("button", { name: "Save to Wishlist" })
          .querySelector("[data-action-state]"),
      ).toHaveAttribute("data-action-state", "success"),
    );
    const updates = body.getByRole("status", { name: "Journal updates" });
    await expect(updates).toHaveTextContent(confirmation);
    finishFirst({
      snapshot: {
        owner: "search-player",
        entries: [
          {
            ...games[0],
            gameId: games[0].id,
            status: "backlog",
            addedAt: new Date("2026-11-01"),
          },
        ],
      },
    });
    // Wait for A's response to update the shared Journal, then inspect B's feedback.
    await within(canvasElement).findByText("Backlog (1)");
    await expect(body.getByText("Current status: Wishlist")).toBeVisible();
    await expect(
      body
        .getByRole("button", { name: "Save to Wishlist" })
        .querySelector("[data-action-state]"),
    ).toHaveAttribute("data-action-state", "success");
    await expect(updates).toHaveTextContent(confirmation);
    await expect(
      body.getAllByRole("status", { name: "Journal updates" }),
    ).toHaveLength(1);
    await userEvent.click(
      body.getByRole("button", { name: "Back to results" }),
    );
    await expect(updates).toBeEmptyDOMElement();
    await userEvent.click(body.getByRole("option", { name: /^The Legend/ }));
    await expect(body.getByText("Current status: Wishlist")).toBeVisible();
    await expect(body.queryByText(confirmation)).not.toBeInTheDocument();
  },
};
