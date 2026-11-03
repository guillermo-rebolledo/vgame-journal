import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
  title: "UI/Dropdown menu",
  component: DropdownMenuTrigger,
  subcomponents: {
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Actions and mutually exclusive choices anchored to a trigger. Reuse JournalStatus for game recording rather than rebuilding its persistence and confirmation behavior. Source: src/components/ui/dropdown-menu.tsx.",
      },
    },
  },
  render: function Render() {
    const [status, setStatus] = useState("Backlog");
    return (
      <div className="grid gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            Journal actions
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={status} onValueChange={setStatus}>
                {["Played", "Playing", "Backlog", "Wishlist"].map((value) => (
                  <DropdownMenuRadioItem key={value} value={value} closeOnClick>
                    {value}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <p className="text-sm">Selected Status: {status}</p>
      </div>
    );
  },
} satisfies Meta<typeof DropdownMenuTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;
export const KeyboardAndSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Journal actions" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole("menu")).toBeVisible();
    await userEvent.click(body.getByRole("menuitemradio", { name: "Playing" }));
    await expect(canvas.getByText("Selected Status: Playing")).toBeVisible();
    await waitFor(() => expect(trigger).toHaveFocus());
    await waitFor(() =>
      expect(
        body.queryByRole("menu", { hidden: true }),
      ).not.toBeInTheDocument(),
    );
  },
};
