# Production error monitoring (disabled by default)

No account setup, trial, payment, deployment or production enablement is part of
this implementation. Do not run a Sentry wizard. Keep both flags unset until the
owner separately authorizes setup and verifies every gate below.

## Release gates

- Existing Developer/$0 organization, sole user, no subscription, payment method,
  Business trial, add-ons or PAYG. Verify current quota/reset dates and other
  projects sharing it. Published allowance is 5,000 accepted errors/month with
  30-day error lookback. Repeats consume quota; exhaustion drops data until reset.
  No paid fallback. Preserve Vercel operational logs.
- Verify regional project DSN, organization/project slugs, IP storage behavior,
  server-side scrubbing, source artifact retention and deletion controls. Update
  the privacy notice with the verified region/settings before enabling.
- Verify source-map uploads on actual Developer (not a trial), using an org:ci
  organization token if supported. Never expand scopes without evidence. If free
  uploads are unavailable, omit upload credentials and record minified-stack limits.
- Verify a free email alert for new/regressed production issues reaches the owner.
  Do not assume advanced alerts or quota emails are available.

## Configuration

Production runtime/build requires SENTRY_ENABLED=1,
SENTRY_PREREQUISITES_VERIFIED=1, VERCEL=1, VERCEL_ENV=production,
NODE_ENV=production, BETTER_AUTH_URL=https://shelve.games (or www), a valid VERCEL_GIT_COMMIT_SHA, NEXT_PUBLIC_SENTRY_DSN and
SENTRY_INGEST_HOST. The latter must exactly match the approved regional ingest
host (`o<number>.ingest.[us.|de.]sentry.io`). CI, VITEST, STORYBOOK and E2E_TEST
contexts always disable capture/uploads even with inherited credentials.
The build derives NEXT_PUBLIC_SENTRY_ENABLED and NEXT_PUBLIC_SENTRY_RELEASE;
never set these manually. Browser capture also checks shelve.games/www.shelve.games.
No navigation URLs are sent, so dynamic paths fail closed by omission.

Private upload additionally requires SENTRY_ORG, SENTRY_PROJECT and
SENTRY_AUTH_TOKEN. The token is a build-only secret; use the hosting secret store,
never NEXT_PUBLIC variables, chat, fixtures or logs. Missing credentials leave
maps off and capture usable with minified frames. Upload errors fail the build.
Only generated client maps are deleted; server maps stay private. Never enable
productionBrowserSourceMaps independently. Inspect `.next/static` for maps and
reachable sourceMappingURL targets before deploying. Build and upload must use
the same commit/release. The normal production build applies migrations before
Next compilation: a failed upload can leave migrations applied while old code
serves, so migrations must remain backward compatible. No schema change here.

For local checks use `pnpm exec next build` with SENTRY_ENABLED unset (not the
production migration wrapper). Tests and catalog never need Sentry credentials.
Only sanitized error events are transmitted; other envelope types are discarded.
No tracing, request/database integrations, breadcrumbs, logs, metrics, Replay,
attachments, monitors, sessions or remote CSP reports. Delivery is best effort,
bounded to 1.5s, without retries of app operations. Caught errors schedule a Next
`after` flush; request hooks await flushing. Identity/cause deduplication is local
to a runtime; separate Proxy invocations cannot share an object registry.

## Separately authorized production acceptance

After all gates and explicit authorization, temporarily trigger fixed nonpersonal
owner-only browser, server render, route/action and caught fallback failures.
Check counts (including independent identical errors), source-mapped origin
frames/Debug IDs/release, sanitized envelopes, error-only ingest, alert email,
small quota increments, preserved Vercel logs and public map unavailability.
Remove the triggers; never induce data loss or real email-provider failures.
Ad blockers, offline clients, CSP enforcement or quota exhaustion can prevent
capture. Public DSN abuse can consume quota. No promise of complete observability.

References: [manual SDK setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/),
[options](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/),
[pricing](https://sentry.io/pricing/). Account capabilities remain unverified.
