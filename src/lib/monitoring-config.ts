/** Configuration is deliberately inert until the separately authorized release gates are met. */
export function monitoringConfig(
  env: Record<string, string | undefined> = process.env,
) {
  if (
    !["https://shelve.games", "https://www.shelve.games"].includes(
      env.BETTER_AUTH_URL ?? "",
    ) ||
    env.SENTRY_ENABLED !== "1" ||
    env.VERCEL !== "1" ||
    env.VERCEL_ENV !== "production" ||
    env.NODE_ENV !== "production" ||
    env.CI ||
    env.VITEST ||
    env.STORYBOOK ||
    env.E2E_TEST ||
    env.SENTRY_PREREQUISITES_VERIFIED !== "1"
  )
    return null;
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN;
  const release = env.VERCEL_GIT_COMMIT_SHA;
  const host = env.SENTRY_INGEST_HOST;
  if (
    !dsn ||
    !release ||
    !/^[a-f0-9]{40,64}$/i.test(release) ||
    !host ||
    !/^o\d+\.ingest\.(?:us\.|de\.)?sentry\.io$/.test(host)
  )
    return null;
  try {
    const url = new URL(dsn);
    if (
      url.protocol !== "https:" ||
      url.hostname !== host ||
      url.port ||
      !/^[a-f0-9]{32}$/.test(url.username) ||
      url.password ||
      !/^\/\d+$/.test(url.pathname) ||
      url.search ||
      url.hash
    )
      return null;
    return { dsn, origin: url.origin, release };
  } catch {
    return null;
  }
}
