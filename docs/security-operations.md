# Security and privacy operations

This is a runbook and evidence ledger, not evidence that production controls passed.
Repository review: 2026-11-09, ticket #132, initial base `132545f`.
No production database, credential rotation, restore or provider dashboard was accessed for this implementation. Tests use synthetic data and isolated PGlite.

## Owner decisions blocking operational sign-off

All rows below are **pending**. The service owner must name a responsible person and record dated, sanitized evidence in the restricted operations record. Do not put secrets, user records, feed URLs, email bodies or recovery links in GitHub.

| Area | Required owner input / evidence | Owner | Date / result |
| --- | --- | --- | --- |
| Privacy and incident contact | Publish a monitored confidential contact usable without signing in; identify service operator and escalation backup; test receipt and response ownership. In-app Feedback exists, but its production inbox and monitoring are unverified. | Unassigned | Pending |
| Retention | Approve actual database, Neon backup/PITR, Vercel logs/telemetry, Resend delivery records and owner mailbox retention, region and deletion limits. Set a periodic review date. Update `/privacy` with verified facts. | Unassigned | Pending |
| GitHub | Inventory organization/repository admins, outside collaborators, apps, deploy keys and tokens; MFA/recovery coverage; minimum repository permissions; protected integration/default branches; dependency/security alert recipient and escalation. | Unassigned | Pending |
| Vercel | Inventory team/project members, deploy tokens and integrations; MFA and least privilege; production/preview/development environment scope; deployment/log access, sensitive path redaction and log retention. | Unassigned | Pending |
| Neon | Inventory organization/project/database access; MFA; separate production and test credentials/targets; least-privilege application role; backup retention, restore window, restore permissions and isolated exercise. | Unassigned | Pending |
| Email | Inventory Resend team, domain/API key scopes, delivery-log access and owner mailbox membership; MFA; verify sender domain and Feedback delivery/replies without exposing content. | Unassigned | Pending |
| Google / Twitch | Inventory OAuth app owners, secrets, redirect URIs and consent scope; MFA and least privilege; verify enabled production providers. | Unassigned | Pending |
| Production browser/auth checks (#133–#137) | HTTPS; Secure/HttpOnly/SameSite cookie behavior; allowed origins/cross-origin rejection; trusted proxy/IP behavior; shared authentication limits; recent-auth deletion and session revocation; report-only CSP compatibility before enforcement. Use controlled accounts; record actual results. | Unassigned | Pending |
| Alerts | Enable and route dependency/security alerts, failed deployments, provider incidents and anomalous auth/error volume to a named responder. Demonstrate test alert acknowledgement without logging credentials or private text. | Unassigned | Pending |
| Recovery and incident exercise | Record isolated restore outcome, incident rehearsal, escalation and follow-up owners. | Unassigned | Pending |

A completed record needs: control, environment, responsible owner, UTC date, evidence location, observed result, exceptions, next review date. A configuration screenshot alone does not prove a successful restore or delivery.

## Read-only GitHub configuration observation

On **2026-11-09**, `gh api repos/guillermo-rebolledo/vgame-journal --jq .security_and_analysis`
returned `dependabot_security_updates: disabled`, `secret_scanning: enabled` and
`secret_scanning_push_protection: enabled` (each is the returned `status` value).
This is a configuration observation, not proof of alert ownership, routing,
receipt or acknowledgement. GitHub access/alert sign-off above remains pending.
No remote security settings were changed.

## Repository facts supporting the notice

The authoritative player-facing notice is `src/app/privacy/page.tsx`. Recheck it whenever these boundaries change.

| Claim | Repository evidence | Limit |
| --- | --- | --- |
| Stored account/authentication and Journal data | `src/db/schema.ts`, `src/lib/auth.ts` | Schema permits session IP/user-agent and provider tokens; actual provider contents depend on sign-in method. No production inspection performed. |
| Public fields exclude notes, email and feed credentials | `src/lib/journal.ts` publicProfile; `src/components/public-profile.tsx` | Profile visibility is owned by #120. Initial base exposes profiles by username; do not promise a Private default before that work lands. Public Lists use their own visibility in `src/lib/lists.ts`. |
| Community rating includes all players' qualifying Ratings | `src/lib/journal.ts` communityRating | Anonymous aggregate participation is independent of profile visibility; minimum threshold gates publication. |
| Journal export | `src/lib/journal.ts` exportData; `src/app/api/account/export/route.ts` | Includes profile, entries/Ratings, Status history, Playthroughs/private notes and Lists. Excludes feedback, credentials, provider logs and mailbox copies; not a complete privacy access response. |
| Account deletion | `src/lib/journal.ts` deleteAccount; cascading foreign keys in `src/db/schema.ts` | Removes account-linked live database records including feedback; resets removed by account id. Delivered mail, downloaded/shared copies, logs and backups are outside this operation. No immediate backup-erasure promise. |
| Calendar link secrecy and regeneration | `src/app/api/calendar/[token]/route.ts`, `src/lib/calendar-feed.ts`, `src/lib/journal.ts` feedToken/regenerateFeedToken | Token is the only authentication. Feed has exact-day Wishlist release titles/dates and game identifiers; old URL fails after regeneration, but external copies cannot be recalled. |
| Minimized analytics | `src/components/analytics.tsx`, `src/components/analytics.test.tsx` | Vercel Analytics and Speed Insights share URL minimization: usernames/List IDs redacted, fragments and non-allowlisted queries removed. Bounded product events include booleans such as presence of notes, never note/feedback bodies. Do not assert that hosting/provider logs use this client filter. Calendar token redaction in operational tooling remains a production verification task. |
| Feedback database vs email | `src/lib/feedback.ts`, `src/lib/email.ts`, `.env.example` | Stores account reference, type, message, page path and time; optional email includes username, path, message and reply-to account email. `FEEDBACK_EMAIL` enables notifications; deployment value/monitoring unknown. |
| Providers | `src/db/index.ts`, `src/lib/auth.ts`, `src/lib/email.ts`, `src/components/analytics.tsx`, `src/lib/igdb.ts`, `vercel.json` | Neon database; Vercel hosting/analytics/performance; Resend email; Google optional sign-in; IGDB/Twitch Catalog and image delivery. Configured integrations are evidence of intended use, not proof of production access controls, retention, regions or contractual terms. Better Auth runs in the app; it is not an additional hosted identity provider. |

## Access, MFA and environment separation

1. Owner inventories human and machine access for each service in the ledger. Remove stale grants with an approved change; give application/service accounts only required permissions. Keep at least one tested recovery path with restricted access.
2. Require MFA for administrative accounts and the owner mailbox; store recovery material outside source control and logs. Check offboarding revokes active sessions, tokens and integrations.
3. Verify production, preview, development and tests use distinct targets and appropriately scoped credentials. Never pull production environment secrets into automated tests. E2E uses its support server and PGlite; module tests use `createTestDb()`. Check test-only bypasses cannot disable production safeguards.
4. Record periodic access review and named backup owner. Keep evidence private; the public ledger can link to a restricted record without exposing its contents.

## Credential rotation procedure (operator only)

1. Identify the credential, consumers, environment, scope, expiry and rollback route. Schedule and approve the change; assess session impact before changing the Better Auth secret.
2. Create a replacement with minimal scope in the provider dashboard/secret store. Update only intended environment bindings and redeploy consumers. Never paste values into tickets, terminal transcripts or screenshots.
3. Verify synthetic sign-in, email, Catalog, cron or database behavior as appropriate. Revoke the prior credential after cutover and verify it no longer works. If overlap is unsupported, document downtime/recovery beforehand.
4. Record dates, credential identifiers (never values), owner and outcome. A suspected leak requires incident handling as well as rotation.

Calendar feed URLs are player credentials too: regenerate in Settings after accidental sharing and resubscribe calendar clients. Redact the whole token path in hosting, alerting and support tooling. Regeneration cannot erase events already fetched by another app.

## Backups and isolated restore exercise (operator only)

1. Confirm the actual Neon plan, backup/PITR window, retention, access, deletion schedule and recovery objectives. Record the facts; do not infer them from provider defaults.
2. Approve an isolated nonproduction restore destination with restricted access and no production traffic. Disable outbound email, cron, analytics and integrations; never overwrite production or attach production domains.
3. Restore an approved recovery point into that destination. Prefer synthetic fixture data; if a production snapshot is necessary, obtain explicit approval and apply restricted handling and sanitization before anyone inspects it.
4. Verify migration state, representative account/Journal/List relationships and recovery time. Use synthetic checks; do not copy private notes or authentication data into the evidence record. Confirm deleted-account handling before any recovery is promoted, so restoration does not silently republish deleted data.
5. Record recovery point, elapsed time, observed data loss, failures and remediation. Tear down the restored target and temporary credentials according to the approved handling plan. Schedule the next exercise. No restore was performed by this ticket.

## Incident handling

1. The assigned responder acknowledges the report in the monitored confidential channel. Record detection time, scope and owner; never ask for passwords, tokens or private Journal text. Publish that channel before claiming incident reporting is operational.
2. Preserve minimal restricted evidence with redacted paths/identifiers. Check application, Vercel, Neon and Resend logs without copying full sensitive payloads. Do not enable body logging to investigate.
3. Contain access with the operator's approval: revoke affected sessions/keys, disable compromised integrations or pause unsafe features. Avoid destroying evidence; record changes and times.
4. Determine affected data/accounts and recovery steps. The owner obtains any necessary legal advice on notifications and communicates verified facts through a safe channel. No compliance or notification deadline is asserted by this runbook.
5. Recover through a reviewed deployment or isolated restore process, verify controls, then document cause, impact, remediation owners and follow-up dates.

## Privacy requests and deletion limits

1. Until a monitored public contact is confirmed, signed-in players can submit a minimal request through account-menu Feedback; production notification routing/monitoring still needs owner verification. Signed-out requests and confidential security reports need the owner-published contact. Never direct players to post personal data in public issues.
2. Verify identity through an appropriate authenticated channel before disclosing or deleting data. Do not request passwords or Calendar links. Record request scope, owner, applicable obligations and response status in a restricted tracker.
3. Offer Settings' Journal export for its documented scope. For a broader request, separately assess feedback records, delivered mail, provider records and relevant logs; the JSON download alone is not a complete response.
4. Explain live database deletion separately from backup expiry, Resend records, owner mailbox copies and copies held by recipients. Coordinate authorized deletion in those systems, record exceptions and actual schedules, and avoid promising immediate erasure everywhere.
5. Confirm completion only for actions actually performed; maintain a minimal restricted record and prevent a later restore from reintroducing deleted data. Update the public notice when owner contact, retention or provider facts are verified.

## Implementation verification for #132

Local verification on 2026-11-09 (synthetic fixtures only):

- Red/green slice 1: signup/footer journey failed on the missing Privacy notice link, then passed after adding `/privacy` and both links.
- Red/green slice 2: Settings journey failed on the missing export-limit explanation, then passed with Settings' privacy link, feed secrecy/copy guidance, and the old feed URL returning 404 after regeneration.
- `pnpm lint` and `pnpm typecheck`: passed.
- `pnpm test --maxWorkers=2`: 41 files, 515 tests passed. The initial unrestricted run hit timeouts and was stopped; the bounded complete rerun passed. Existing timer-overflow warnings were emitted.
- `pnpm test:storybook --maxWorkers=2`: 39 files, 188 tests passed, including signup privacy-link focus and Calendar guidance/regeneration stories.
- `pnpm build-storybook`: passed; catalog remains local/CI-only.
- `pnpm test:e2e e2e/privacy.spec.ts e2e/accessibility.spec.ts e2e/action-feedback.spec.ts --workers=2` (isolated ports): 15 tests passed, including both-theme accessibility scans of `/privacy`, signup and Settings, and Calendar duplicate/failure recovery.
- Final `e2e/privacy.spec.ts` run: 3 tests passed, including both themes at 320, 390, 768 and 1440px, no horizontal page overflow, focusable links, keyboard skip-link activation and reduced motion. Mobile screenshots of the notice, signup and Settings were inspected for readable hierarchy, wrapping and visible focus. These are browser automation and visual inspection results, not physical-device or screen-reader certification.

Manual checks still pending: VoiceOver/other screen-reader navigation and announcements; true browser 200% zoom and text-enlargement review; physical touch/sticky-hover and mobile software-keyboard checks. No new overlays or motion were introduced. Production cookie/header/proxy/auth, logs, provider access, retention, contact delivery and restore checks in the owner ledger remain pending.

Component reuse: signup uses AuthForm's existing children slot; the root footer retains its existing frame; Settings composes its existing bordered section pattern and Download JSON Button. CalendarFeedForm keeps the explanation with its existing URL and CopyButton/Subscribe/Regenerate controls. These were the closest existing components and fit their original responsibilities; no new reusable primitive, dependency, tracking event or feedback intake was added. The static notice uses native article/section headings in the existing focused reading column.
