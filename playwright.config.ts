import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:3100", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/support/server.mjs",
      url: "http://127.0.0.1:3101/health",
      reuseExistingServer: false,
    },
    {
      command: "pnpm exec next build && pnpm exec next start -p 3100",
      url: "http://localhost:3100",
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        E2E_TEST: "1",
        BETTER_AUTH_URL: "http://localhost:3100",
        BETTER_AUTH_SECRET: "e2e-only-secret-at-least-32-characters-long",
        RESEND_API_KEY: "re_e2e",
        RESEND_BASE_URL: "http://127.0.0.1:3101",
        DATABASE_URL: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        TWITCH_CLIENT_ID: "",
        TWITCH_CLIENT_SECRET: "",
      },
    },
  ],
});
