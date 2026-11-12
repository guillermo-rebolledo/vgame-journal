import { captureException } from "@sentry/nextjs";

export function captureBrowserError(error: Error) {
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "1") return;
  try {
    captureException(error);
  } catch {
    /* Recovery must remain available. */
  }
}
