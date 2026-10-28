import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // PGlite's first WASM startup and migrations can exceed 5s on CI runners.
    testTimeout: process.env.CI ? 15_000 : 5_000,
    env: {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
    },
  },
});
