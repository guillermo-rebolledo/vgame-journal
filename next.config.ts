import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.E2E_TEST === "1" ? ".next-e2e" : ".next",
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  typescript: { tsconfigPath: "tsconfig.build.json" },
  // Rating logos never change; a new logo gets a new filename.
  headers: async () => [
    {
      source: "/ratings/:file*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
  ],
  turbopack: {
    ...(process.env.E2E_TEST === "1" && {
      resolveAlias: {
        "@/db": "./e2e/support/db.ts",
        "@/db/batch": "./e2e/support/batch.ts",
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
