import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const supportPort = Number(process.env.E2E_SUPPORT_PORT ?? 3101);
process.env.E2E_SUPPORT_URL = `http://127.0.0.1:${supportPort}`;

export default defineConfig({
  testDir: "./e2e",
  // Spread a file's tests across workers so one long spec doesn't finish alone. Opt out per file with mode: "serial".
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // ubuntu-latest has 4 cores; Playwright would default to 2. Specs are mostly awaiting the server.
  workers: process.env.CI ? 4 : undefined,
  use: { baseURL: `http://localhost:${port}`, trace: "on-first-retry" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: "discovery.spec.ts",
    },
    // Reuse focused journeys, keeping the complete suite on Chromium.
    {
      name: "firefox-smoke",
      use: { ...devices["Desktop Firefox"] },
      grep: /@release-smoke/,
      retries: 0,
    },
    {
      name: "webkit-smoke",
      use: { ...devices["Desktop Safari"] },
      grep: /@release-smoke/,
      retries: 0,
    },
    // Discovery specs hold, fail and empty the shared discovery feed that Home
    // tests read, so CI runs this project in its own job with its own server.
    // One worker: copies of these specs (--repeat-each) would release each other's holds.
    {
      name: "global-state",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "discovery.spec.ts",
      workers: 1,
    },
  ],
  webServer: [
    {
      command: "node e2e/support/server.mjs",
      url: `${process.env.E2E_SUPPORT_URL}/health`,
      reuseExistingServer: false,
    },
    {
      command: `pnpm exec next build && pnpm exec next start -p ${port}`,
      url: `http://localhost:${port}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        E2E_TEST: "1",
        CRON_SECRET: "e2e-cron-secret",
        BETTER_AUTH_URL: `http://localhost:${port}`,
        BETTER_AUTH_SECRET: "e2e-only-secret-at-least-32-characters-long",
        FEEDBACK_EMAIL: "delivered@resend.dev",
        RESEND_API_KEY: "re_e2e",
        RESEND_BASE_URL: process.env.E2E_SUPPORT_URL,
        DATABASE_URL: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        TWITCH_CLIENT_ID: "",
        TWITCH_CLIENT_SECRET: "",
      },
    },
  ],
});
