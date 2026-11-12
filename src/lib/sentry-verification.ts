import { timingSafeEqual } from "node:crypto";

/** Temporary owner capability: an expiring secret, never a URL parameter or client prop. */
export function sentryVerificationAllowed(
  authorization: string | null,
  token = process.env.SENTRY_VERIFICATION_TOKEN,
  now?: number,
) {
  const match = token?.match(/^(\d{13})\.[a-f0-9]{64}$/);
  if (!match || !authorization) return false;
  if (Number(match[1]) <= (now ?? Date.now())) return false;
  const expected = `Bearer ${token}`;
  const actualBytes = Buffer.from(authorization);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}
