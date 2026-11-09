/** Only the local harness with an isolated database may bypass authentication limits. */
export function isIsolatedE2E() {
  if (
    process.env.E2E_TEST !== "1" ||
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.DATABASE_URL
  )
    return false;

  const isLoopback = (value: string | undefined) => {
    try {
      const url = new URL(value ?? "");
      return (
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      );
    } catch {
      return false;
    }
  };
  return (
    isLoopback(process.env.BETTER_AUTH_URL) &&
    isLoopback(process.env.E2E_SUPPORT_URL)
  );
}
