import { defineConfig } from "@playwright/test";

// No remote target option, credential reuse, traces, screenshots or HTML reports.
if (process.env.VERCEL_ENV === "production" || process.env.DATABASE_URL) {
  throw new Error(
    "Run operations harness without production environment or DATABASE_URL",
  );
}
process.env.E2E_SUPPORT_URL = "http://127.0.0.1:3411";
export default defineConfig({
  testDir: ".",
  testMatch: "capacity.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 1800000,
  reporter: [["list"]],
  outputDir: "../../test-results/operations",
  use: {
    baseURL: "http://127.0.0.1:3410",
    navigationTimeout: 15000,
    actionTimeout: 10000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: [
    {
      command: "node e2e/support/server.mjs",
      cwd: "../..",
      url: "http://127.0.0.1:3411/health",
      reuseExistingServer: false,
      env: { E2E_SUPPORT_PORT: "3411" },
    },
    {
      command:
        "pnpm exec next build && pnpm exec next start -H 127.0.0.1 -p 3410",
      cwd: "../..",
      url: "http://127.0.0.1:3410",
      reuseExistingServer: false,
      timeout: 180000,
      env: {
        E2E_TEST: "1",
        E2E_SUPPORT_URL: "http://127.0.0.1:3411",
        BETTER_AUTH_URL: "http://127.0.0.1:3410",
        BETTER_AUTH_SECRET: "operations-synthetic-secret-at-least-32-chars",
        DATABASE_URL: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        TWITCH_CLIENT_ID: "",
        TWITCH_CLIENT_SECRET: "",
        RESEND_API_KEY: "re_e2e",
        RESEND_BASE_URL: "http://127.0.0.1:3411",
        RESEND_EMAIL_DOMAIN: "",
        FEEDBACK_EMAIL: "",
        CRON_SECRET: "operations-synthetic-cron",
      },
    },
  ],
});
