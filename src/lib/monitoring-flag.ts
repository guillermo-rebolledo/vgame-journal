import { vercelAdapter } from "@flags-sdk/vercel";
import { flag } from "flags/next";

/** Deployment-wide switch: no player identity, targeting or request overrides. */
export const sentryMonitoringFlag = flag<boolean>({
  key: "sentry-monitoring",
  description: "Production error monitoring. Changes require a redeploy.",
  defaultValue: true,
  adapter: vercelAdapter(),
});
