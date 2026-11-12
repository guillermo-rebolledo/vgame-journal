# Production error monitoring

No account setup, trial, payment, deployment or production enablement is part of
this implementation. Do not run a Sentry wizard. Complete the checklist below before
adding production credentials or deploying enabled monitoring. Verification is an
operational checklist, not an environment variable.

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

The deployment-wide Vercel flag `sentry-monitoring` defaults to **on**, including
when the provider has no value or evaluation fails. Set it off in Vercel before
building if monitoring should be disabled. Flag evaluation uses no player identity,
cookies or targeting attributes. Changing it requires a new production build:
existing deployments retain their browser/server capture, CSP and upload decisions.
Local, preview, test and catalog builds never evaluate this flag.

Production runtime/build also requires VERCEL=1, VERCEL_ENV=production,
NODE_ENV=production, BETTER_AUTH_URL=https://shelve.games (or www), a valid VERCEL_GIT_COMMIT_SHA, NEXT_PUBLIC_SENTRY_DSN and
SENTRY_INGEST_HOST. The latter must exactly match the approved regional ingest
host (`o<number>.ingest.[us.|de.]sentry.io`). GitHub Actions, nondeployment CI, VITEST, STORYBOOK and E2E_TEST
contexts always disable capture/uploads even with inherited credentials. Vercel
production builds set CI=1; that value is allowed only with a valid system-provided
VERCEL_DEPLOYMENT_ID and every other production prerequisite. Enable access to
Vercel System Environment Variables; do not manually override CI.
The build snapshots the flag into NEXT_PUBLIC_SENTRY_ENABLED and derives NEXT_PUBLIC_SENTRY_RELEASE;
never set these manually. The old SENTRY_ENABLED and SENTRY_PREREQUISITES_VERIFIED
variables are no longer used. Browser capture also checks shelve.games/www.shelve.games.
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

For local checks use `pnpm exec next build` outside a Vercel production context (not
the production migration wrapper). Tests and catalog never need Sentry credentials.
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

## Temporary trial verification

The owner authorized technical verification during the trial ending November 26,
2026. This does **not** verify Developer/$0 capabilities or change the billing gate.
Production deployment of the probes still needs approval. The build explicitly
throws a fixed, nonpersonal error on source-map upload failure; the SDK default
only logs these failures, which can otherwise leave a green deployment without maps. No real Journal writes,
authentication failures or provider failures are needed.

The temporary controls at `/internal/sentry-verification` and the server-render
probe at `/internal/sentry-verification/render` require an Authorization Bearer
capability on every request, including Server Actions. The API at
`/api/internal/sentry-verification` accepts POST with the same capability and a fixed
`x-sentry-verification-kind`: `route`, `caught`, or `independent` (two distinct errors).
These exercise the existing SDK initialization and operational-error path. Duplicate
reporting of the same caught Error should produce one event; independent errors
should produce two. Sanitization intentionally replaces the synthetic messages;
identify events by the new deployment release, origin frames and capture operation.

Set a temporary server-only `SENTRY_VERIFICATION_TOKEN` with a 13-digit Unix
millisecond expiry followed by a dot and 64 cryptographically random lowercase hex
characters. Generate it immediately before the approved deployment, with a short
expiry. Never use URL parameters, browser props, public environment variables,
logs, clipboard or shell arguments for this capability. Inject it only into
same-origin verification requests. Absent, expired or mismatched capabilities
return 404; the pages use no-store and noindex. Remove the environment value and
these temporary routes after acceptance, then redeploy to remove the controls.
The Playwright fixture uses its own short-lived dummy capability and disables all
Sentry capture and uploads.
