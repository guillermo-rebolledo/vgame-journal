import path from "node:path";
import type { StorybookConfig } from "@storybook/nextjs-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: ["./*.mdx", "../src/components/**/*.stories.@(ts|tsx)"],
  staticDirs: ["../public"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
    "@storybook/addon-mcp",
  ],
  features: { componentsManifest: true },
  core: { disableTelemetry: true },
  typescript: { reactDocgen: "react-docgen-typescript" },
  viteFinal: (config) => ({
    ...config,
    plugins: [...(config.plugins ?? []), tailwindcss()],
    resolve: {
      ...config.resolve,
      alias: [
        {
          find: "@/app/lists/actions",
          replacement: path.resolve(
            import.meta.dirname,
            "list-actions.mock.ts",
          ),
        },
        {
          find: "@/app/home-actions",
          replacement: path.resolve(
            import.meta.dirname,
            "home-actions.mock.ts",
          ),
        },
        ...(Array.isArray(config.resolve?.alias)
          ? config.resolve.alias
          : Object.entries(config.resolve?.alias ?? {}).map(
              ([find, replacement]) => ({ find, replacement }),
            )),
      ],
    },
    optimizeDeps: {
      ...config.optimizeDeps,
      include: [...(config.optimizeDeps?.include ?? []), "next/link"],
    },
  }),
};

export default config;
