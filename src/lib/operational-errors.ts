/** Fixed vocabulary only: never pass paths, user identifiers, input, or raw errors. */
const OPERATIONS = [
  "server.render",
  "server.action",
  "server.route",
  "server.proxy",
  "database.request",
  "game_source.request",
  "account_email.verification",
  "account_email.password_reset",
  "feedback.write",
  "feedback.notification",
  "lists.read",
  "lists.write",
  "journal.set",
  "journal.move",
  "journal.setRating",
  "journal.clearRating",
  "journal.remove",
  "journal.addPlaythrough",
  "journal.recordPlaythrough",
  "journal.updatePlaythrough",
  "journal.removePlaythrough",
  "journal.setRegion",
  "journal.feedToken",
  "journal.regenerateFeedToken",
  "journal.deleteAccount",
  "refresh.wishlist",
  "refresh.discovery",
] as const;
export type Operation = (typeof OPERATIONS)[number];
const CODES = [
  "unexpected",
  "timeout",
  "rate_limited",
  "unavailable",
  "invalid_response",
] as const;
export type OperationalCode = (typeof CODES)[number];

export class OperationalError extends Error {
  constructor(public readonly code: OperationalCode) {
    super(`Operation failed: ${code}`);
  }
}

export function operationalCode(error: unknown): OperationalCode {
  if (error instanceof OperationalError) return error.code;
  if (
    error instanceof Error &&
    ["TimeoutError", "AbortError"].includes(error.name)
  )
    return "timeout";
  return "unexpected";
}

/** Native structured logs are the alert integration point; logging must never break recovery. */
export function reportOperationalError(
  operation: Operation,
  code: OperationalCode = "unexpected",
) {
  if (!OPERATIONS.includes(operation) || !CODES.includes(code)) return;
  const commit = process.env.VERCEL_GIT_COMMIT_SHA;
  const deployment = process.env.VERCEL_DEPLOYMENT_ID;
  try {
    console.error(
      JSON.stringify({
        event: "operational_error",
        version: 1,
        operation,
        code,
        deployment:
          deployment && /^dpl_[a-z0-9]{1,80}$/i.test(deployment)
            ? deployment
            : commit && /^[a-f0-9]{40,64}$/i.test(commit)
              ? commit
              : "unknown",
        timestamp: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
      }),
    );
  } catch {
    /* Telemetry is best effort. */
  }
}

export function observeOperation<Args extends unknown[], Result>(
  operation: Operation,
  run: (...args: Args) => Promise<Result>,
  expected: (error: unknown) => boolean = () => false,
): (...args: Args) => Promise<Result> {
  return async (...args) => {
    try {
      return await run(...args);
    } catch (error) {
      if (!expected(error))
        reportOperationalError(operation, operationalCode(error));
      throw error;
    }
  };
}
