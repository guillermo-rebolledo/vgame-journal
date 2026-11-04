import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CommandSearch } from "./command";
import { Inspector } from "./inspector";
import { QuickAdd } from "./quick-add";

const meta = {
  title: "Prototypes/Game search",
  component: QuickAdd,
  parameters: {
    docs: {
      description: {
        component:
          "Isolated search exploration. Local sample data and local saves only. Production GameSearch and its callers stay unchanged; promote only after choosing a direction.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
        <p className="mt-6">Your Journal stays in place below search.</p>
      </div>
    ),
  ],
} satisfies Meta<typeof QuickAdd>;
export default meta;
type Story = StoryObj<typeof meta>;

export const QuickAddAndChangeStatus: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const trigger = within(canvasElement).getByRole("button", {
      name: "Search games…",
    });
    await userEvent.click(trigger);
    const input = await body.findByRole("searchbox", { name: "Search games" });
    await expect(input).toHaveFocus();
    await userEvent.type(input, "Hollow");
    await userEvent.click(
      body.getByRole("button", {
        name: "Add to backlog for Hollow Knight",
      }),
    );
    await expect(
      body.getByText("Hollow Knight saved to Backlog."),
    ).toBeVisible();
    await expect(
      body.getByRole("button", {
        name: "Backlog: change status for Hollow Knight",
      }),
    ).toHaveFocus();
    await userEvent.click(
      body.getByRole("button", {
        name: "Backlog: change status for Hollow Knight",
      }),
    );
    await userEvent.click(
      await body.findByRole("menuitemradio", { name: "Playing" }),
    );
    await expect(
      body.getByText("Hollow Knight saved to Playing."),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        body.queryByRole("dialog", { hidden: true }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const CommandKeyboard: Story = {
  render: (args) => <CommandSearch {...args} />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const trigger = within(canvasElement).getByRole("button", {
      name: "Search games…",
    });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const search = await body.findByRole("combobox", { name: "Search games" });
    await expect(search).toHaveFocus();
    await userEvent.type(search, "Celeste");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.click(
      await body.findByRole("button", { name: "Save to Wishlist for Celeste" }),
    );
    await expect(
      body.getByRole("status", { name: "Search updates" }),
    ).toHaveTextContent("Celeste saved to Wishlist.");
    await userEvent.click(
      body.getByRole("button", { name: "Back to results" }),
    );
    await expect(
      body.getByRole("combobox", { name: "Search games" }),
    ).toHaveValue("Celeste");
    await expect(
      body.getByRole("combobox", { name: "Search games" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        body.queryByRole("dialog", { hidden: true }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    await waitFor(() =>
      expect(
        body.getByRole("combobox", { name: "Search games" }),
      ).toHaveFocus(),
    );
    await expect(
      body.getByRole("combobox", { name: "Search games" }),
    ).toHaveValue("Celeste");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        body.queryByRole("dialog", { hidden: true }),
      ).not.toBeInTheDocument(),
    );
  },
};

export const InspectorActions: Story = {
  render: (args) => <Inspector {...args} />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Search games…" }),
    );
    await userEvent.type(
      await body.findByRole("combobox", { name: "Search games" }),
      "Dead Cells",
    );
    await userEvent.click(
      await body.findByRole("button", {
        name: "Save to Backlog for Dead Cells",
      }),
    );
    await expect(body.getByText("Dead Cells saved to Backlog.")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        body.queryByRole("dialog", { hidden: true }),
      ).not.toBeInTheDocument(),
    );
  },
};

export const FailedSearchRetry: Story = {
  args: { demoState: "error" },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Search games…" }),
    );
    await userEvent.type(
      await body.findByRole("searchbox", { name: "Search games" }),
      "Hollow",
    );
    await userEvent.click(body.getByRole("button", { name: "Try again" }));
    await expect(body.getByText("Searching the Catalog…")).toBeVisible();
    await expect(
      await body.findByRole("button", {
        name: "Add to backlog for Hollow Knight",
      }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        body.queryByRole("dialog", { hidden: true }),
      ).not.toBeInTheDocument(),
    );
  },
};

export const EmptySearch: Story = {
  args: { demoState: "empty", defaultOpen: true, initialQuery: "Celestee" },
};
export const MissingArtAndLongTitle: Story = {
  args: { defaultOpen: true, initialQuery: "ゼルダ" },
};
export const Loading: Story = {
  args: { defaultOpen: true, demoState: "loading" },
};
export const LightTheme: Story = {
  args: { defaultOpen: true },
  globals: { theme: "light" },
};

export const CommandOpen: Story = {
  args: { defaultOpen: true },
  render: (args) => <CommandSearch {...args} />,
};
export const CommandLight: Story = {
  ...CommandOpen,
  globals: { theme: "light" },
};

export const CommandEmpty: Story = {
  ...CommandOpen,
  args: { defaultOpen: true, demoState: "empty", initialQuery: "Celestee" },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const input = body.getByRole("combobox", { name: "Search games" });
    const controls = input.getAttribute("aria-controls");
    await expect(controls).toBeTruthy();
    await expect(
      canvasElement.ownerDocument.getElementById(controls ?? ""),
    ).toHaveAttribute("role", "listbox");
    await expect(
      body.getByRole("status", { name: "Search updates" }),
    ).toHaveTextContent("No games found");
    await userEvent.click(body.getByRole("button", { name: "Clear search" }));
    await expect(input).toHaveFocus();
    await expect(body.getAllByRole("option")).toHaveLength(8);
  },
};

export const CommandRequestFailure: Story = {
  ...CommandOpen,
  args: { defaultOpen: true, demoState: "error", initialQuery: "Hollow" },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const input = body.getByRole("combobox", { name: "Search games" });
    await expect(input).toHaveAttribute("aria-controls");
    await expect(body.queryAllByRole("option")).toHaveLength(0);
    await userEvent.click(body.getByRole("button", { name: "Try again" }));
    await expect(
      body.getByRole("status", { name: "Search updates" }),
    ).toHaveTextContent("Searching the Catalog");
    await expect(input).toHaveFocus();
    await waitFor(() => expect(body.getAllByRole("option")).toHaveLength(2));
    await expect(input).toHaveValue("Hollow");
  },
};

export const CommandLoading: Story = {
  ...CommandOpen,
  args: { defaultOpen: true, demoState: "loading" },
};
export const CommandMissingMetadata: Story = {
  ...CommandOpen,
  args: { defaultOpen: true, initialQuery: "ゼルダ" },
};
export const InspectorOpen: Story = {
  args: { defaultOpen: true },
  render: (args) => <Inspector {...args} />,
};
export const InspectorLight: Story = {
  ...InspectorOpen,
  globals: { theme: "light" },
};
