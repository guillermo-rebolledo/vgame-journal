import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";

const meta = {
  title: "UI/Hover card",
  component: HoverCard,
  subcomponents: { HoverCardTrigger, HoverCardContent },
  render: () => (
    <HoverCard>
      <HoverCardTrigger
        href="#profile"
        className="underline underline-offset-4"
      >
        Player profile
      </HoverCardTrigger>
      <HoverCardContent>
        <p className="font-medium">Player</p>
        <p className="text-muted-foreground">
          24 games saved in their Journal.
        </p>
      </HoverCardContent>
    </HoverCard>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Optional preview attached to a link. Information needed to complete a task must also be available at the destination. Source: src/components/ui/hover-card.tsx.",
      },
    },
  },
} satisfies Meta<typeof HoverCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ProfilePreview: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("link", {
      name: "Player profile",
    });
    await userEvent.hover(trigger);
    const preview = await within(canvasElement.ownerDocument.body).findByText(
      "24 games saved in their Journal.",
    );
    await waitFor(() => expect(preview).toBeVisible());
    await userEvent.unhover(trigger);
  },
};
