import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useSearchParams } from "@storybook/nextjs-vite/navigation.mock";
import { ReadonlyURLSearchParams } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { SearchResult } from "@/lib/catalog";
import { GameSearch } from "./game-search";
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
    guidance: "Search the Catalog. Choose a game to open its page.",
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
          "GameSearch owns Catalog requests and URL state. CatalogSearch composes the Cover-led Popover, native game-page links, Input, Button, Select, GameCover and HomeCoverLink. Embedded search retains the list editor action stage. Real Catalog requests and URL behavior remain at this boundary; stories replace only browser navigation and the HTTP boundary.",
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
  const input = within(canvasElement).getByRole("combobox", {
    name: "Search games",
  });
  await userEvent.click(input);
  const popup = await body.findByRole("dialog", { name: "Search results" });
  await expect(input).toHaveAttribute("aria-controls", popup.id);
  return { body, input, popup };
};
export const OpenAndDismiss: Story = {
  play: async ({ canvasElement }) => {
    const { body, input } = await open(canvasElement);
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(input).toHaveFocus();
  },
};
export const NativeGameNavigation: Story = {
  play: async ({ canvasElement }) => {
    const { body, input, popup } = await open(canvasElement);
    await userEvent.type(input, "game");
    const first = await body.findByRole("link", { name: /^Celeste / });
    await expect(within(popup).getAllByRole("link")).toHaveLength(25);
    await expect(first).toHaveAttribute("href", "/games/catalog-game-1");
    await expect(first).not.toHaveAttribute("target");
    const activate = fn();
    const intercept = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a")) {
        event.preventDefault();
        event.stopPropagation();
        activate();
      }
    };
    popup.addEventListener("click", intercept, true);
    try {
      await userEvent.click(first);
      await expect(activate).toHaveBeenCalledTimes(1);
      await userEvent.click(input);
      await userEvent.keyboard("{ArrowDown}");
      await waitFor(() => expect(first).toHaveFocus());
      await userEvent.keyboard("{Enter}");
      await expect(activate).toHaveBeenCalledTimes(2);
      await userEvent.keyboard(" ");
      await expect(activate).toHaveBeenCalledTimes(3);
      await userEvent.keyboard("{ArrowDown}");
      await expect(within(popup).getAllByRole("link")[1]).toHaveFocus();
      await userEvent.keyboard("{End}");
      await expect(within(popup).getAllByRole("link").at(-1)).toHaveFocus();
      const scroller = popup.querySelector(".game-catalog-results");
      if (!scroller) throw new Error("Missing results scroller");
      await expect(scroller.scrollTop).toBeGreaterThan(0);
    } finally {
      popup.removeEventListener("click", intercept, true);
    }
  },
};
export const Loading: Story = {
  parameters: { catalog: "loading" },
  play: async ({ canvasElement }) => {
    const { body, input } = await open(canvasElement);
    await userEvent.type(input, "game");
    await expect(
      body.getByRole("status", { name: "Search updates" }),
    ).toHaveTextContent("Searching…");
    await expect(body.queryByRole("link")).not.toBeInTheDocument();
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
  },
};
export const FailureAndRetry: Story = {
  parameters: { catalog: "retry" },
  play: async ({ canvasElement }) => {
    const { body, input } = await open(canvasElement);
    await userEvent.type(input, "game");
    await body.findByRole("alert");
    await expect(input).toHaveValue("game");
    await userEvent.click(body.getByRole("button", { name: "Try again" }));
    await body.findByRole("link", { name: /^Celeste / });
    await expect(body.queryByRole("alert")).not.toBeInTheDocument();
  },
};
export const LongTitlesAndUnknownMetadata: Story = {
  play: async ({ canvasElement }) => {
    const { body, input } = await open(canvasElement);
    await userEvent.type(input, "game");
    await body.findByRole("link", { name: /^Celeste / });
    await expect(body.getByText("Year unavailable")).toBeVisible();
    await expect(body.getByText(/Platform availability unknown/)).toBeVisible();
    await expect(
      body.queryByRole("button", { name: "Back to results" }),
    ).not.toBeInTheDocument();
  },
};
export const LightTheme: Story = {
  ...LongTitlesAndUnknownMetadata,
  globals: { theme: "light" },
};
export const AdjacentFilters: Story = {
  play: async ({ canvasElement }) => {
    const { body, input } = await open(canvasElement);
    await userEvent.type(input, "game");
    await body.findByRole("link", { name: /^Celeste / });
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Release year" }),
    );
    await userEvent.click(await body.findByRole("option", { name: "2024" }));
    await userEvent.click(input);
    await expect(
      body.queryByRole("link", { name: /^Celeste / }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      canvas.getByRole("button", { name: "Clear filters" }),
    );
    await userEvent.click(input);
    await expect(body.getByRole("link", { name: /^Celeste / })).toBeVisible();
  },
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
