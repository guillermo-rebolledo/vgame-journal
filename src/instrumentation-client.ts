import * as Sentry from "@sentry/nextjs";
import { monitoringOptions } from "./lib/monitoring-options";

if (
  process.env.NEXT_PUBLIC_SENTRY_ENABLED === "1" &&
  ["shelve.games", "www.shelve.games"].includes(window.location.hostname)
) {
  try {
    Sentry.init({
      ...monitoringOptions(
        process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
        process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? "",
      ),
      integrations: [Sentry.globalHandlersIntegration()],
    });
  } catch {
    /* Monitoring cannot prevent hydration. */
  }
}
