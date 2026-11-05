import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus, Save } from "lucide-react";
import { useId, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  ActionFeedback,
  ActionIcon,
  type ActionState,
} from "./action-feedback";
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: {
    children: "Add to Journal",
    variant: "default",
    size: "default",
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "outline",
        "secondary",
        "ghost",
        "destructive",
        "link",
      ],
    },
    size: {
      control: "select",
      options: [
        "default",
        "xs",
        "sm",
        "lg",
        "icon",
        "icon-xs",
        "icon-sm",
        "icon-lg",
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Shared action control. Enabled presses scale to 0.96 over 150ms with ease-out; reduced motion stays stationary. Use press=static for anchored triggers. Reuse a variant for emphasis; use a link for navigation. Icon-only buttons need an accessible name. Source: src/components/ui/button.tsx.",
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", {
      name: "Add to Journal",
    });
    button.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      {(
        [
          "default",
          "outline",
          "secondary",
          "ghost",
          "destructive",
          "link",
        ] as const
      ).map((variant) => (
        <Button {...args} key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};
export const Disabled: Story = { args: { disabled: true } };
export const IconOnly: Story = {
  args: { size: "icon", "aria-label": "Add game", children: <Plus /> },
};
export const LongLabel: Story = {
  args: {
    children:
      "Add The Lantern Keeper and the Library Beyond the Last Horizon to your Journal",
    className: "max-w-64",
  },
};
export const LightTheme: Story = { globals: { theme: "light" } };

export const StaticTrigger: Story = {
  args: { press: "static", children: "Open actions" },
};
export const FocusableDisabled: Story = {
  args: { disabled: true, focusableWhenDisabled: true },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button");
    button.focus();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const AsyncFeedback: Story = {
  render: function AsyncButton(args) {
    const [state, setState] = useState<ActionState>("idle");
    const [attempts, setAttempts] = useState(0);
    const id = useId();
    return (
      <div className="max-w-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={state === "pending"}
            aria-busy={state === "pending"}
            aria-describedby={state === "error" ? id : undefined}
            onClick={async (event) => {
              setState("pending");
              args.onClick?.(event);
              await new Promise((resolve) => setTimeout(resolve, 500));
              setState(attempts === 0 ? "error" : "success");
              setAttempts(attempts + 1);
            }}
          >
            <ActionIcon
              icon={<Save />}
              state={state === "success" ? "idle" : state}
            />
            Save
          </Button>
          <output
            aria-live="polite"
            aria-atomic="true"
            className="min-h-5 text-sm"
          >
            {state === "pending" ? (
              "Saving…"
            ) : state === "success" ? (
              <ActionFeedback state="success">Saved</ActionFeedback>
            ) : (
              ""
            )}
          </output>
        </div>
        {state === "error" && (
          <p id={id} role="alert" className="text-destructive text-sm">
            Couldn’t save. Choose Save to try again. Your draft is kept.
          </p>
        )}
      </div>
    );
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole("button", { name: "Save" });
    save.focus();
    await userEvent.keyboard("{Enter}{Enter}");
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute("aria-busy", "true");
    await expect(args.onClick).toHaveBeenCalledOnce();
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Your draft is kept.",
    );
    await expect(save).toHaveAccessibleDescription(/Choose Save to try again/);
    await userEvent.click(save);
    await expect(canvas.getByRole("status")).toHaveTextContent("Saving…");
    await expect(
      await canvas.findByText("Saved", { exact: true }),
    ).toBeVisible();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await expect(save).toBeEnabled();
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};
