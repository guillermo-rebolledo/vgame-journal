import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.E2E_TEST === "1" ? ".next-e2e" : ".next",
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    ...(process.env.E2E_TEST === "1" && {
      resolveAlias: {
        "@/db": "./e2e/support/db.ts",
        "@/lib/igdb": "./e2e/support/game-source.ts",
      },
    }),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
