/** Honor both Retry-After forms without waiting inside a request or retrying it. */
export function retryAfterUntil(value: string | null) {
  const now = Date.now();
  const seconds =
    value !== null && /^\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
  const until = Number.isFinite(seconds)
    ? now + seconds * 1000
    : Date.parse(value ?? "");
  return Number.isFinite(until) ? Math.max(now + 1000, until) : now + 1000;
}
