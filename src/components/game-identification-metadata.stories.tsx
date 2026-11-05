import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { GameIdentificationMetadata } from "./game-identification-metadata";

const meta = {
  title: "Product/Game identification metadata",
  component: GameIdentificationMetadata,
  args: {
    title: "Phantom Blade Zero",
    year: 2026,
    platforms: [
      "PC",
      "PlayStation 5",
      "Xbox Series X|S",
      "Nintendo Switch 2",
      "Meta Quest 3",
    ],
  },
  parameters: {
    docs: {
      description: {
        component:
          "Identity metadata beside a game link. Remaining platforms open in a hover card rather than in flow, so neighbouring cards in a shelf never move. It reuses HoverCard: hover, tap and Enter or Space open it, Escape dismisses it and returns focus, and focus alone does not, so tabbing across a shelf stays quiet.",
      },
    },
  },
} satisfies Meta<typeof GameIdentificationMetadata>;
export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardToggle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", {
      name: /More platforms for Phantom Blade Zero$/,
    });
    await expect(trigger).toHaveTextContent("+4 platforms");
    trigger.focus();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{Enter}");
    const list = await body.findByRole("list", {
      name: "Additional platforms for Phantom Blade Zero",
    });
    await expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    await userEvent.keyboard(" ");
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "false"),
    );
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "true"),
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "false"),
    );
    await expect(trigger).toHaveFocus();
  },
};

export const TouchToggle: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: /More platforms for Phantom Blade Zero$/,
    });
    await userEvent.pointer([
      { keys: "[TouchA>]", target: trigger },
      { keys: "[/TouchA]" },
    ]);
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "true"),
    );
    await userEvent.pointer([
      { keys: "[TouchA>]", target: trigger },
      { keys: "[/TouchA]" },
    ]);
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "false"),
    );
  },
};

export const SinglePlatform: Story = {
  args: { platforms: ["PC (Microsoft Windows)"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("PC")).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const Unknown: Story = {
  args: { year: null, platforms: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Year unavailable")).toBeVisible();
    await expect(
      canvas.getByText("Platform availability unknown"),
    ).toBeVisible();
  },
};

export const LightTheme: Story = { globals: { theme: "light" } };
