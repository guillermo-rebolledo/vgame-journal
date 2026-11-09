# Browser and log verification (#135)

Prepared 2026-11-09. Production evidence is **pending**. This document covers the
browser/log slice of #130; the privacy notice and broader service-access checklist
belong to the privacy implementer. The service owner must assign a named operator
and record the deployment SHA, date, result and sanitized evidence for each row.
Local tests do not establish deployed HTTPS, cookie, proxy or provider behavior.

## Implemented baseline

- Every route receives `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, a Permissions Policy
  disabling camera, microphone and geolocation, and HSTS with a one-year lifetime.
  HSTS deliberately excludes subdomains and preload; browsers only honor it over
  HTTPS. The existing immutable Rating-logo cache rule remains in place.
- CSP starts as **report-only**, never enforcement. The candidate permits existing
  inline Next rendering/theme scripts and styles, IGDB covers, Google avatar
  images, same-origin assets, Vercel telemetry, and Google form navigation.
  It does not introduce nonces or change Cache Components rendering. Inline
  scripts remain a limitation to resolve before a stricter enforcement rollout.
- There is no `report-uri`, `report-to`, `Reporting-Endpoints`, or `report-sample`.
  CSP reports can carry the full document URL, including reset/feed credentials;
  do not attach an external collector or upload raw console reports. Inspect the
  report-only console locally with synthetic credentials, then redact evidence.
- The existing `Analytics` component and shared `redactAnalyticsEvent` hook remain
  the sole integration for Web Analytics and Speed Insights. Both `url` and the
  optional Speed Insights `route` redact Calendar feed credentials, auth endpoint
  paths, usernames and List IDs. URL userinfo, fragments and unapproved query
  fields are removed. Malformed/non-HTTP URLs become a fixed redacted sentinel.
- Query retention is limited to recognized Status, sort, view and boolean values,
  four-digit years from 1900–2199, and existing paging keys with values 1–9999.
  Duplicate keys are dropped. Campaign fields and platform names are removed:
  arbitrary values under an allowed key are still arbitrary private text.
  Existing product events retain their enum/boolean/bucket catalogue; no private
  notes, search text, feedback message, email, auth proof, feed token or raw IDs
  are added as event properties.

## Final review corrections (2026-11-09)

The direct `auth.api` boundary is now protected as well as handler/fetch. A real
getSession call with a synthetic database failure originally retained private SQL
in APIError.cause; the regression now verifies a fixed cause-free error before
Next can receive it. All direct server API methods use the same boundary,
including currentSession, proxy and Settings. Intended client errors and redirects
retain their behavior. Feedback persistence failures now return a fixed retry
error without raw database causes and cannot report success or send notification
mail; existing draft/retry behavior remains.

Google-only deletion now uses the owner-approved verified-email code plus typed
DELETE. Forced OAuth reauthentication scaffolding and mocked auth_time acceptance
claims have been removed. Local browser evidence includes the actual Resend SDK
against a local mailbox, with safe failed-delivery retry. It does not establish
live mail delivery or deployed Google sign-in. See `account-security-verification.md`
and `security-review.md` for policy and evidence; all operator rows below remain pending.

## Historical source audit and cross-cutting recommendations

Application audit at initial base `132545f`, with the mail-logging follow-up
implemented against integration `2754e7c` and the application-auth logging follow-up
against `23bb7e9`:

| Path | Finding / parent action |
| --- | --- |
| `src/components/analytics.tsx` and its callers | Shared telemetry hook hardened here. Existing product-event callers supply bounded metadata rather than private text. No new tracking was added. |
| `src/lib/feedback.ts` | **Resolved in source:** notification failure logs only `Feedback email failed`, without the caught value. A synthetic sensitive error/cause regression verifies one stored report, success and one delivery attempt; callers do not need to resubmit. |
| `src/lib/email.ts` | **Resolved in source:** provider rejections and thrown network/SDK failures become a fresh `Error("Email delivery failed")`, with no raw message, properties or cause retained. The Email object is never logged. Synthetic regressions cover both failure modes and successful delivery. |
| `src/lib/auth.ts` | **Resolved locally for application auth logging:** installed Better Auth 1.7.12 logs raw database errors in OAuth `link-account.mjs` and `session.mjs`, and provider input in `callback.mjs`. A custom logger discards every message/argument/context and emits only `Authentication diagnostic` at the supplied severity (default warn/error threshold). No provider message is allowlisted. Better Call 1.4.4 also logs uncaught errors directly, bypassing that logger; supported `onAPIError.throw: true` plus the existing `createAuth` handler boundary prevents that fallback and returns an empty 500 with a static error diagnostic. Both `handler` and its `fetch` alias are protected. Known API errors/redirects retain their responses. Synthetic handler regressions cover endpoint/rate-limit/session database failures, OAuth error/warning redirects and the existing four mail-failure flows. Hosting/traces, deployed forwarding/origins and provider behavior remain operator checks. |
| `src/lib/catalog.ts`, `src/components/discovery.tsx`, cron refresh route | Current explicit errors use fixed messages or the internal Discovery cache key; no private text or auth/feed credentials are deliberately logged. Framework/provider errors still need operator verification. |
| Hosting/request logs and log drains | Application redaction does **not** rewrite Vercel access-log request paths, firewall events, traces, or third-party drains. `/api/calendar/<token>` remains credential-bearing at that boundary. Restrict access/retention and configure path/query suppression where supported; if raw storage cannot be suppressed, record this remaining exposure and an owner-approved mitigation. Do not claim feed credentials are absent from hosting logs. |
| Delivered email and mailbox | Auth emails necessarily contain verification/reset links; feedback notifications contain the message, username and reply address. Provider logs and the recipient mailbox are separate retention/access surfaces, unaffected by database deletion or analytics redaction. Privacy implementer must describe verified practices. |

The application-auth follow-up changes logging/error configuration and protects the
existing request handler; Settings and the privacy notice are unchanged. Direct
server-side `auth.api` callers still receive errors normally; callers and framework
traces must not log raw caught values. This does not sanitize provider/hosting logs.

## Pending production evidence

All rows below are **pending operator verification**; no production credentials,
database, live rotations, restore or load tests were used for this implementation.
Use a controlled account and non-sensitive fixtures. Keep complete evidence in a
restricted location; commit only sanitized observations and a reference.

| Check | Operator procedure and required evidence | Owner / date / result |
| --- | --- | --- |
| HTTPS and hostnames | Verify HTTP redirects to the canonical HTTPS origin, certificate/hostname validity, preview/custom domains, and absence of downgrade redirects. Inspect actual HSTS after Vercel/CDN overrides. Do not enable subdomain/preload coverage without a domain inventory. | Service owner / pending / pending |
| Browser response headers | Inspect final document, auth/API, Calendar, redirect, 404 and static responses. Confirm baseline headers, CSP report-only only, no report destination, and immutable Rating logos. Record header names/values without `Set-Cookie` values or credential-bearing paths. | Service owner / pending / pending |
| Session/OAuth cookies | Through real email sign-in, reset and Google callback, record cookie **names and attributes only**: HttpOnly, Secure on HTTPS, intended SameSite, Path, Domain, expiry and secure prefixes where applicable. Verify no broad Domain or unneeded JavaScript-readable auth cookie. Local HTTP is not evidence. | Auth operator / pending / pending |
| Trusted origins and cross-origin defenses | Confirm deployed canonical `BETTER_AUTH_URL`, explicit trusted origins and Google redirect URIs. Using a controlled account, attempt a state-changing auth request from an untrusted Origin, and inspect rejection plus lack of credentialed wildcard CORS. Verify valid email and Google flows still work. Never paste tokens/cookies into this document. | Auth operator / pending / pending |
| Proxy/client IP trust | Record whether traffic reaches Vercel directly or through another proxy. Verify the documented forwarding header is overwritten/trusted correctly and an attacker-supplied forwarding header cannot select the rate-limit identity. Coordinate with the shared-rate-limit implementer; avoid collecting IPs in durable evidence. | Deployment + auth operator / pending / pending |
| CSP compatibility | On the deployed report-only build, exercise email verification/reset, real Google round trip, Journal/Lists, covers/avatars/logos, themes, inline styles, rendering/navigation, Web Analytics and Speed Insights. Review console violations locally; classify allowed sources and unexpected ones. Check production and preview-toolbar differences. Record sanitized directive/origin summaries, never raw document/blocked URLs. | Browser operator / pending / pending |
| Telemetry payloads | In DevTools inspect outgoing `/_vercel/insights` and `/_vercel/speed-insights` traffic with synthetic usernames, List IDs, query secrets and auth URLs. Confirm sanitized `url` and `route`, bounded custom properties, and no secrets/private text in other payload fields or referrers. Confirm accepted events in the provider dashboard without exporting raw events. | Analytics operator / pending / pending |
| Application/auth/email logs | In an isolated preview, induce delivery/network/auth failures with synthetic sensitive markers. Inspect runtime logs/traces for private notes, feedback bodies, recipient addresses, reset/verification/proof tokens, cookies, authorization headers and Calendar credentials. Confirm the source email-boundary and application-auth fixes in deployed runtime logs before marking passed; local regression coverage does not complete this operator check. | App + email operator / pending / pending |
| Hosting/firewall/drains | Review access to Vercel request/runtime/firewall logs and configured drains, request path/query fields, retention and deletion controls. Use synthetic feed/auth paths, verify suppression or document the credential exposure and mitigation. Inspect preview as well as production configuration. | Hosting operator / pending / pending |
| Provider/mailbox retention | Confirm actual Resend account configuration, log/body access, retention/deletion options, recipient mailbox access and retention. Record verified values for the privacy implementer; published defaults alone do not prove account configuration or mailbox behavior. | Email operator / pending / pending |

## Local evidence (2026-11-09)

Application-auth logging follow-up (2026-11-09):

- Red: the endpoint database sentinel reached the default logger and Better Call's
  direct `# SERVER_ERROR` console fallback. A custom logger alone still failed
  because that fallback retained the raw error, cause and hidden query property.
  Green: static severity-preserving logging plus `onAPIError.throw` and the
  request-handler catch removed those payloads and retained an empty 500.
- Five new `createAuth` handler regressions cover endpoint/rate-limit/session
  database failures, OAuth provider-error arguments and unknown-provider warning
  context; captured console arguments retain only the static diagnostic.
  Existing mail regressions now expect the same static diagnostic and preserve
  their HTTP results and delivery-attempt counts.
- After merging integration `29e0306` (including #134), all **44 tests in five
  auth/account-security files** passed with `--maxWorkers=1 --testTimeout=30000`.
  `pnpm lint`, `pnpm typecheck` and `git diff --check` passed. The source conflict
  retained the then-current account-security hooks/provider configuration and the log guard; those forced-reauthentication hooks are now removed.
- The broader unit run, started before the integration merge, passed **547 tests
  in 45 files** with `--maxWorkers=1 --testTimeout=30000`; the 44-test focused
  rerun above checks the final merged auth/account code. Existing Node timer
  overflow/deprecation warnings remain.
- No UI was changed by this follow-up; browser, Storybook, real Google, production
  and operator checks were not run. All operator rows above remain pending.

Mail-logging follow-up:

- Email-boundary provider-message and network-error/cause tests each failed before
  their fix, then passed. The feedback regression likewise reproduced raw error
  logging before the fixed-message catch passed.
- The two Better Auth handler regressions also fail against the original email
  boundary, exposing synthetic recipient/body/link/error-cause data. They pass
  with normalization, retaining existing HTTP behavior (sign-up 200, unverified
  sign-in 403, verification resend 500, reset request 200) and one delivery attempt
  per request. Tests mock only Resend and use migrated in-memory PGlite; no real
  email, Neon, Google or production access is used.

- Final follow-up validation: `pnpm test --maxWorkers=2` passes all **540 tests
  in 44 files**; `pnpm lint`, `pnpm typecheck` and `git diff --check` pass.
  No UI changed; browser, Storybook and production/operator checks were not run.

Earlier browser/telemetry slice evidence:

- Red/green module tests reproduced Calendar/auth path leaks, unbounded query
  retention, URL userinfo, malformed URLs, encoded prefixes and control-character
  bypasses; the final analytics module has 26 passing tests.
- The HTTP test failed on missing headers before configuration changes. The
  production-mode isolated Playwright harness then passed the header test and
  existing auth journeys (12 tests), plus Journal/Calendar/export/deletion
  journeys (6 tests). The harness uses its local database and mock mailbox, not
  Neon or real Google credentials; Google provider evidence remains pending.
- `pnpm test --maxWorkers=2` passes all 520 tests in 41 files. The first
  unrestricted run hit existing Catalog/Journal test timeouts under concurrent
  load; limiting workers completed the final suite successfully.
- `pnpm lint` and `pnpm typecheck` pass. No visual UI, interaction or product copy
  changed, so Storybook, accessibility scans and design manual checks were not
  run for this slice. The existing Analytics component was extended in place;
  no UI primitives or new product components were needed.

## Rollout gate

Keep CSP report-only until the operator evidence above is complete. Before
enforcing it, resolve required-source violations and explicitly assess inline
script restrictions against Next Cache Components, themes and rendering. Review
any reporting design for sensitive document URLs before enabling collection.
Local/header tests cannot authorize a claim that production safeguards passed.

## References checked

- [Better Auth options](https://better-auth.com/docs/reference/options#logger)
  documents the custom logger and `onAPIError` controls. Installed **1.7.12**
  `@better-auth/core/dist/env/logger.{mjs,d.mts}` confirms severity filtering and
  the `log(level, message, ...args)` signature; `types/init-options.d.mts` confirms
  `onAPIError.throw` and `onError`. `better-auth/dist/api/index.mjs` shows an
  `onError` hook alone cannot suppress Better Call's fallback (its result is
  discarded and hook exceptions are caught), while `throw: true` propagates.
- [Better Call 1.4.4 router source](https://github.com/better-auth/better-call/blob/v1.4.4/packages/better-call/src/router.ts)
  matches installed `better-call/dist/router.mjs`: rethrown API errors become
  responses; other rethrows escape before direct raw `console.error`. Disabling
  the Better Auth logger alone would leave this fallback exposed.
- Installed Next **16.4.2** Route Handlers guide:
  `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`;
  handlers use native Request/Response and run at request time by default.

- Installed Next **16.4.2**:
  `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`
  and `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`.
  These document global path matching and nonce/dynamic-rendering requirements.
- [Vercel Web Analytics redaction](https://vercel.com/docs/analytics/redacting-sensitive-data)
  and [Speed Insights configuration](https://vercel.com/docs/speed-insights/package)
  document the separate `beforeSend` hooks. This application uses one shared hook.
- [Vercel Runtime Logs](https://vercel.com/docs/logs/runtime) documents request
  metadata and application logs, which remain separate from browser telemetry.
- [Vercel request headers](https://vercel.com/docs/headers/request-headers) and
  [reverse proxies](https://vercel.com/docs/security/reverse-proxy) are the sources
  for the operator's deployment-specific forwarding review.
- [Better Auth security](https://www.better-auth.com/docs/reference/security) and
  [cookies](https://www.better-auth.com/docs/concepts/cookies) describe protections
  whose actual deployed attributes/origins still need verification.
- [Resend data practices](https://resend.com/security/gdpr) describes provider
  retention; confirm the account and mailbox settings before promising a period.
