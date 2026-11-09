# Authentication throttling (#133)

The lockfile installs Better Auth **1.7.12**. This verifies the installed build input, not the currently deployed package. GitHub's deployments API returned no deployment records, and no Vercel deployment connector is available here, so a service operator must confirm the deployed release/version. No production database or live credentials were accessed during implementation.

The app reuses Better Auth's database rate limiter and the existing Drizzle/Postgres connection. Migration `0018_account_security_privacy.sql` adds `rate_limit`, a unique bucket key and an expiry-cleanup index alongside profile visibility. Apply this migration before deploying this code. Old app versions do not use the new table. Main’s existing 0016/0017 feedback migrations are preserved unchanged; this security slice follows them.

Limits are per normalized client IP and auth endpoint path. Better Auth's installed defaults allow three sign-in/signup attempts per rolling 10 seconds, and three recovery/verification email requests per rolling 60 seconds. Explicit rules also limit password-reset submission, reset-link requests and email verification to three per 60 seconds. Reset links have separate buckets per token path; reset submission and email requests have fixed paths. Other auth endpoints retain the provider's default 100 requests per 10 seconds. Accepted requests move the rolling window; rejected requests do not extend it. A 429 response has the same generic message regardless of account existence, and `X-Retry-After` gives the wait in seconds. The existing AuthForm announces the error, retains nonsecret fields, clears passwords, and keeps retry and recovery available. No UI component or motion changed.

## Atomicity evidence

[Better Auth's official rate-limit documentation](https://better-auth.com/docs/concepts/rate-limit) requires atomic consumption for shared storage. Installed source was inspected in `better-auth/dist/api/rate-limiter/index.mjs` and `@better-auth/drizzle-adapter/dist/index.mjs`, rather than assuming persistence alone prevents concurrency bypass:

- The unique `key` constraint arbitrates concurrent creation. A collision re-reads and retries consumption.
- Active windows use `incrementOne` with a `count < max` predicate and `count = count + 1`. The Postgres adapter repeats the predicates on the actual UPDATE and uses RETURNING to decide whether the request claimed an attempt. [PostgreSQL's Read Committed rules](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED) recheck the predicate after a competing update holds the row lock.
- Expired windows use a conditional reset guarded by the previously read `lastRequest`; competing resets retry against the fresh row.
- There is no response-phase read/overwrite of the counter. Database errors fail the request; they do not fall back to process memory.

`src/lib/auth-rate-limit.test.ts` exercises real handlers on independently created auth instances sharing one migration-backed PGlite database. Bursts of 18 requests across six instances admit exactly three, both for a new bucket and after expiry. A separate database starts with an independent allowance, ruling out accidental process-global persistence. Tests also cover retry timing, header selection and the E2E bypass boundary. These are local Postgres semantic tests, not deployed load-test evidence. Server-side `auth.api` calls do not pass through HTTP rate limiting; keep unauthenticated mutations behind the auth handler.

## Trusted IP and test isolation

[Vercel documents](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for) that `x-vercel-forwarded-for` carries its client IP, whereas another proxy can affect `x-forwarded-for`. On Vercel the app accepts only the former, with Better Auth's single-address validation and default IPv6 /64 normalization. It does not trust arbitrary forwarding chains or a fallback header. Without a trusted IP Better Auth uses one shared per-endpoint bucket, preserving protection but potentially limiting unrelated visitors. Non-Vercel environments intentionally have no trusted header configuration; review this if hosting changes.

Both Next's test database aliases and auth's bypass use the same `isIsolatedE2E` guard. It requires `E2E_TEST=1`, absent Vercel deployment flags, an empty DATABASE_URL, and HTTP loopback auth/support URLs. Next's production-mode local E2E build still works; copying E2E_TEST into a Vercel production/preview environment cannot disable protection or select the test database.

## Operator evidence required before closing deployment acceptance

Owner: service maintainer. Status on 2026-11-09: **pending operator execution**, not verified by this implementation.

1. In an isolated preview with synthetic accounts, verify the deployed release uses the committed lockfile (Better Auth 1.7.12) and migration 0018 is applied. Record deployment ID, release SHA, date and operator. Do not record credentials or raw bucket/IP values.
2. Confirm the actual Vercel/custom-proxy topology. Send deliberately different forwarding headers from a controlled client and verify they cannot obtain fresh allowances. Confirm distinct controlled client networks receive distinct buckets. Check behavior when the trusted header is unavailable. Do not add a diagnostic endpoint exposing IPs or session data.
3. On that preview, issue a bounded concurrent burst across cold/warm function instances. Verify exactly three admissions per protected endpoint/window, generic 429 bodies and retry timing; wait for expiry and retry. Exercise sign-in, signup, recovery email, reset submission, verification email and verification links. Confirm no unexpected duplicate emails are delivered beyond the admitted attempts.
4. Confirm preview/production environment separation and that no E2E flags or test aliases are active. Locally tested guard behavior is not evidence of deployed environment contents.
5. Inspect table growth/expiry cleanup under ordinary traffic and assess shared-IP false positives. Better Auth prunes old rows when an existing bucket resets; inactive expired rows can remain until a later reset triggers cleanup. Record any need for a maintenance cleanup job rather than promising immediate deletion.

Use sanitized status/count evidence only. Do not perform unattended production bursts, change production environment variables, rotate secrets or migrate a live database to satisfy this checklist.

## Local validation (2026-11-09)

- Red/green regressions established store isolation, missing recovery/verification rules, hosted E2E bypass rejection and trusted-header selection before their corresponding implementation changes.
- `pnpm lint` and `pnpm typecheck`: passed.
- `pnpm test --maxWorkers=2 --testTimeout=30000`: 42 files, 530 tests passed, including all 15 limiter integration cases. The first default-worker run was interrupted after load-related five-second timeouts; it is not counted as a pass.
- `pnpm test:e2e e2e/auth.spec.ts`: 12 passed, including the throttled error/retry/recovery journey and existing enlarged-text/theme recovery checks.
- No UI implementation changed. AuthForm and its existing alert, input-retention, password-clearing and retry patterns are reused directly. Storybook and manual design checks were not rerun for this backend/configuration change.
