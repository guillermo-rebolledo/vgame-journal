import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/nextjs-vite";
import { sb } from "storybook/test";
import { TooltipProvider } from "../src/components/ui/tooltip";
import "../src/app/globals.css";
import "./preview.css";

// Catalog interactions must never send production analytics.
sb.mock("../src/components/analytics.tsx");

const preview: Preview = {
  tags: ["autodocs"],
  initialGlobals: { theme: "dark" },
  decorators: [
    withThemeByClassName({
      themes: { light: "light", dark: "dark" },
      defaultTheme: "dark",
      parentSelector: "html",
    }),
    (Story) => (
      <TooltipProvider>
        <div className="p-4 text-foreground">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: {
      test: "error",
      options: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      },
    },
    options: { storySort: { order: ["Start here", "UI", "Product"] } },
  },
};

export default preview;
