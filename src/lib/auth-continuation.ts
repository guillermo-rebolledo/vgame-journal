/** Untrusted continuations may only navigate within the app, outside auth/API routes. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || /[\\\p{Cc}]/u.test(value)) return "/";
  // Query/fragment values cannot change the navigation origin; decode only the path.
  let decoded = value.split(/[?#]/, 1)[0];
  try {
    for (;;) {
      if (
        !decoded.startsWith("/") ||
        decoded.startsWith("//") ||
        /[\\\p{Cc}]/u.test(decoded)
      )
        return "/";
      const url = new URL(decoded, "https://continuation.invalid");
      if (
        url.origin !== "https://continuation.invalid" ||
        /^\/(?:sign-in|sign-up|onboarding|forgot-password|reset-password|api)(?:\/|$)/i.test(
          url.pathname,
        )
      )
        return "/";
      const next = decodeURIComponent(decoded);
      if (next === decoded) return value;
      decoded = next;
    }
  } catch {
    return "/";
  }
}

/** Keep ordinary auth URLs bare for direct visits and the existing signup flow. */
export function authPageHref(
  path: "/sign-in" | "/sign-up" | "/onboarding",
  returnTo: string | null | undefined,
): string {
  const destination = safeReturnTo(returnTo);
  return destination === "/"
    ? path
    : `${path}?${new URLSearchParams({ returnTo: destination })}`;
}
