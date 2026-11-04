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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
          "Actions and mutually exclusive choices anchored to a trigger. Reuse JournalStatus for game recording rather than rebuilding its persistence and confirmation behavior. Popup transitions retarget on reversal and keep only opacity under reduced motion. Source: src/components/ui/dropdown-menu.tsx.",
      },
    },
  },
  render: function Render() {
    const [status, setStatus] = useState("Backlog");
    return (
      <div className="grid gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" press="static" />}
          >
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
    const menu = await body.findByRole("menu");
    await waitFor(() => expect(menu).toBeVisible());
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

export const NestedTheme: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" press="static" />}>
        Appearance
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup defaultValue="dark">
              {["Light", "Dark", "System"].map((theme) => (
                <DropdownMenuRadioItem key={theme} value={theme.toLowerCase()}>
                  {theme}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Appearance",
    });
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.hover(await body.findByRole("menuitem", { name: "Theme" }));
    await expect(
      await body.findByRole("menuitemradio", { name: "Dark" }),
    ).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{Escape}{Escape}");
    await waitFor(() =>
      expect(
        body.queryByRole("menu", { hidden: true }),
      ).not.toBeInTheDocument(),
    );
    await expect(trigger).toHaveFocus();
  },
};
