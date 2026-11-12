import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
import { monitoringConfig } from "./lib/monitoring-config";
import { monitoringOptions } from "./lib/monitoring-options";
import { installErrorCapture } from "./lib/operational-errors";

const config = monitoringConfig();
if (config) {
  try {
    Sentry.init({
      ...monitoringOptions(config.dsn, config.release),
      enableOpenTelemetrySetup: false,
    });
    installErrorCapture((error, operation, code) => {
      Sentry.captureException(error ?? new Error("Operational failure"), {
        tags: { operation, code },
      });
      try {
        after(() =>
          Sentry.flush(1500).then(
            () => {},
            () => {},
          ),
        );
      } catch {
        void Sentry.flush(1500).catch(() => {});
      }
    });
  } catch {
    /* Monitoring cannot prevent startup. */
  }
}

export async function flushErrors() {
  try {
    await Sentry.flush(1500);
  } catch {
    /* Best effort. */
  }
}
