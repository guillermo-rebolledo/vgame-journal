import type { Instrumentation } from "next";
import { expectedMonitoringError } from "@/lib/error-monitoring";
import { monitoringConfig } from "@/lib/monitoring-config";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && monitoringConfig())
    try {
      await import("./sentry.server.config");
    } catch {
      /* Monitoring cannot prevent startup. */
    }
}

import {
  operationalCode,
  reportOperationalError,
} from "@/lib/operational-errors";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  _request,
  context,
) => {
  if (expectedMonitoringError(error)) return;
  const operation =
    context.routeType === "render"
      ? "server.render"
      : context.routeType === "action"
        ? "server.action"
        : context.routeType === "proxy"
          ? "server.proxy"
          : "server.route";
  reportOperationalError(operation, operationalCode(error), error);
  if (process.env.NEXT_RUNTIME === "nodejs" && monitoringConfig()) {
    try {
      const { flushErrors } = await import("./sentry.server.config");
      await flushErrors();
    } catch {
      /* Preserve request failures. */
    }
  }
};
