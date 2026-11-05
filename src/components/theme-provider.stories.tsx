import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useTheme } from "next-themes";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "./theme-provider";
import { Button } from "./ui/button";

function ThemeChoices() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex gap-2">
      {["light", "dark", "system"].map((value) => (
        <Button
          key={value}
          variant="outline"
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
        >
          {value}
        </Button>
      ))}
    </div>
  );
}

const meta = {
  title: "UI/Theme provider",
  component: ThemeProvider,
  args: { children: <ThemeChoices /> },
  parameters: {
    docs: {
      description: {
        component:
          "App appearance and browser theme color share the resolved Light, Dark or System selection. Browser tint uses the header background. These buttons demonstrate the provider; the app uses the account menu.",
      },
    },
  },
} satisfies Meta<typeof ThemeProvider>;
export default meta;
type Story = StoryObj<typeof meta>;

export const BrowserColor: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const head = canvasElement.ownerDocument.head;
    for (const [theme, color] of [
      ["light", "#ffffff"],
      ["dark", "#0a0a0a"],
    ]) {
      await userEvent.click(canvas.getByRole("button", { name: theme }));
      await waitFor(() =>
        expect(head.querySelector('meta[name="theme-color"]')).toHaveAttribute(
          "content",
          color,
        ),
      );
    }
  },
};
