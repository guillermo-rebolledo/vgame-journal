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

## Source audit and cross-cutting recommendations

Application audit at initial base `132545f`:

| Path | Finding / parent action |
| --- | --- |
| `src/components/analytics.tsx` and its callers | Shared telemetry hook hardened here. Existing product-event callers supply bounded metadata rather than private text. No new tracking was added. |
| `src/lib/feedback.ts` | **Parent fix required:** the email-failure catch logs the raw error object. Replace it with a fixed message (or explicitly allowlisted error code); provider/network errors may contain request details. Preserve saved-feedback success behavior and test with a synthetic sensitive error. |
| `src/lib/email.ts` | **Parent fix required:** `sendWithResend` throws the raw provider error message, and network exceptions can propagate. Normalize failures to a fixed safe error at the email boundary so auth/framework logging cannot expose recipient, message body or reset/verification URL. Do not log the Email object. Coordinate this with the feedback change. |
| `src/lib/auth.ts` | Owned by the authentication implementer, unchanged here. Audit Better Auth logger/error handling with synthetic delivery and database failures; keep auth proofs, callback URLs, credentials and request bodies out. Verify trusted origin/IP settings against deployed forwarding, rather than trusting arbitrary incoming headers. |
| `src/lib/catalog.ts`, `src/components/discovery.tsx`, cron refresh route | Current explicit errors use fixed messages or the internal Discovery cache key; no private text or auth/feed credentials are deliberately logged. Framework/provider errors still need operator verification. |
| Hosting/request logs and log drains | Application redaction does **not** rewrite Vercel access-log request paths, firewall events, traces, or third-party drains. `/api/calendar/<token>` remains credential-bearing at that boundary. Restrict access/retention and configure path/query suppression where supported; if raw storage cannot be suppressed, record this remaining exposure and an owner-approved mitigation. Do not claim feed credentials are absent from hosting logs. |
| Delivered email and mailbox | Auth emails necessarily contain verification/reset links; feedback notifications contain the message, username and reply address. Provider logs and the recipient mailbox are separate retention/access surfaces, unaffected by database deletion or analytics redaction. Privacy implementer must describe verified practices. |

These recommendations intentionally do not edit authentication configuration,
Settings, the feedback/email boundary, or the privacy notice from this slice.

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
| Application/auth/email logs | In an isolated preview, induce delivery/network/auth failures with synthetic sensitive markers. Inspect runtime logs/traces for private notes, feedback bodies, recipient addresses, reset/verification/proof tokens, cookies, authorization headers and Calendar credentials. Verify the parent email-boundary fix before marking passed. | App + email operator / pending / pending |
| Hosting/firewall/drains | Review access to Vercel request/runtime/firewall logs and configured drains, request path/query fields, retention and deletion controls. Use synthetic feed/auth paths, verify suppression or document the credential exposure and mitigation. Inspect preview as well as production configuration. | Hosting operator / pending / pending |
| Provider/mailbox retention | Confirm actual Resend account configuration, log/body access, retention/deletion options, recipient mailbox access and retention. Record verified values for the privacy implementer; published defaults alone do not prove account configuration or mailbox behavior. | Email operator / pending / pending |

## Local evidence (2026-11-09)

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
