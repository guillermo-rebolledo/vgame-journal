import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Info } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const meta = {
  title: "UI/Tooltip",
  component: Tooltip,
  subcomponents: { TooltipTrigger, TooltipContent },
  render: () => (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="About Wishlist" />
        }
      >
        <Info />
      </TooltipTrigger>
      <TooltipContent>
        Wishlist includes released and upcoming games.
      </TooltipContent>
    </Tooltip>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Supplementary help on hover or focus. Keep essential instructions in visible text; name the trigger independently. TooltipProvider is installed in the catalog preview. Source: src/components/ui/tooltip.tsx.",
      },
    },
  },
} satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HoverHelp: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "About Wishlist",
    });
    await userEvent.hover(trigger);
    const tooltip = await within(canvasElement.ownerDocument.body).findByText(
      "Wishlist includes released and upcoming games.",
    );
    await waitFor(() => expect(tooltip).toBeVisible());
    await userEvent.unhover(trigger);
  },
};
