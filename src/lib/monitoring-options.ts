import type { BrowserOptions, ErrorEvent } from "@sentry/nextjs";
import { createErrorFilter, sanitizeErrorEvent } from "./error-monitoring";

export function monitoringOptions(
  dsn: string,
  release: string,
): BrowserOptions {
  return {
    dsn,
    release,
    environment: "production",
    sampleRate: 1,
    defaultIntegrations: false,
    integrations: [],
    tracesSampleRate: 0,
    tracePropagationTargets: [],
    sendClientReports: false,
    maxBreadcrumbs: 0,
    beforeSend: createErrorFilter(release),
    // Final wire boundary: no SDK-added context, envelope metadata or non-error products.
    transport: ({ url }) => {
      const pending = new Set<Promise<void>>();
      return {
        send(envelope) {
          const work = (async () => {
            for (const [header, payload] of envelope[1]) {
              if (
                header.type !== "event" ||
                !payload ||
                typeof payload !== "object"
              )
                continue;
              const event = sanitizeErrorEvent(payload as ErrorEvent, release);
              if (!event) continue;
              await fetch(url, {
                method: "POST",
                credentials: "omit",
                referrerPolicy: "no-referrer",
                headers: { "Content-Type": "text/plain" },
                body: `${JSON.stringify({ event_id: event.event_id })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`,
                signal: AbortSignal.timeout(1500),
              });
            }
          })().catch(() => {});
          pending.add(work);
          void work.finally(() => pending.delete(work));
          return work.then(() => ({}));
        },
        async flush() {
          await Promise.allSettled([...pending]);
          return true;
        },
      };
    },
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
  };
}
