# Integrated security acceptance (#137)

2026-11-09. Prepared worktree `t3/d2f04461` was clean at the requested integration
base `10efbabacc975d4cab7b71b130ad9362284d51da`; the fetched integration matched.
Work is committed on `t3/account-security-acceptance` without pushing.
Read #137, full #130 and #120's profile requirements, repository/design/catalog
guidance and all four security runbooks. No production data, credentials,
provider configuration, rotations, restores or live tests were used.

## Changes and regression evidence

- Privacy notice now explains the landed Private default, existing-account
  Public backfill, owner preview and Settings control. The existing privacy
  browser journey failed on the missing explanation before the copy change.
  The operations ledger no longer describes visibility as unimplemented.
- Google deletion requests now explicitly request essential `auth_time`, as
  required by Google's OIDC docs. The existing real-handler/mock-provider seam
  failed on the absent claim request, then all nine account-security cases
  passed. Freshness/account/session/purpose/one-use checks remain enforced.
  **This does not establish working Google reauthentication; see the blocker.**
- The visibility journey now warms owner-only HTML before outsider requests,
  checks generic 404 metadata without profile URLs, and checks Public/Private
  List document/image access for both another account and a guest. The first
  expanded run had an incorrect expected 404 title: proxy rewrites intentionally
  use generic `shelve.games` metadata. The assertion now checks that contract.
- Updated the existing List export/deletion journey to confirm the password
  before typed DELETE. Its old sequence could no longer reach the final control
  after #134, leaving List/Calendar deletion isolation unverified by that journey.
- Reproduced the historical Bottom Browser Toolbar axe failure with
  `pnpm test:storybook src/components/list-creation-drawer.stories.tsx -t 'Bottom Browser Toolbar' --maxWorkers=1 --repeats=15`.
  The story ended during the closing transition with Base UI focus guards still
  mounted. It now awaits the hidden drawer and restored trigger focus before
  restoring viewport mocks and running axe. The same command passed all 16
  executions. No rule, selector, motion or production component was disabled.

## Automated acceptance

Dependencies installed with `pnpm install --frozen-lockfile`; initial validation
could not start because this worktree had no `node_modules`.

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed |
| `pnpm test --maxWorkers=1 --testTimeout=30000` | 46 files / 558 tests passed (165.48s) |
| `pnpm test:storybook --maxWorkers=2` | 42 files / 200 tests passed after drawer fix |
| `pnpm build-storybook` | Passed after drawer fix; upstream directive/docgen warnings |
| Production-mode Playwright (command below) | 48 passed / 1 stale deletion-journey failure; corrected journey passed focused rerun (17.5s test / 24.9s total) |
| `git diff --check` | Passed |

Unit runs emitted existing Node timer-overflow/deprecation and jsdom navigation
warnings; no failed tests. Browser runs use `next build && next start` with the
local support server, synthetic accounts, mock email and empty database, Google
and Twitch credentials.

```sh
E2E_PORT=3190 E2E_SUPPORT_PORT=3191 pnpm test:e2e e2e/profile-visibility.spec.ts e2e/account-security.spec.ts e2e/journal.spec.ts e2e/auth.spec.ts e2e/privacy.spec.ts e2e/security-headers.spec.ts e2e/accessibility.spec.ts e2e/custom-lists.spec.ts e2e/custom-lists-public.spec.ts --workers=2
E2E_PORT=3190 E2E_SUPPORT_PORT=3191 pnpm test:e2e e2e/custom-lists.spec.ts -g 'lists preserve Journal' --workers=1
E2E_PORT=3190 E2E_SUPPORT_PORT=3191 pnpm test:e2e e2e/profile-visibility.spec.ts --workers=2
```

The broad run's failure timed out at the absent typed confirmation. After adding
password confirmation, the focused List lifecycle verifies export/private notes,
List and Calendar cleanup, revoked sessions and another account's surviving data.
Final profile rerun: all 3 tests passed (13.4s), including the strengthened
private email exclusion checks. All 49 selected journeys have passing evidence
across the broad run and focused reruns; a single clean 49-test rerun was not
performed after updating the stale List journey.

The existing seams cover: migration backfill/default; owner/other/guest profile
publication and withdrawal, no-store HTML/Flight/OG and private-field exclusion;
independent Lists; password and mock Google proof failure, expiry, replay,
mismatch, cancellation, concurrency and rollback; final DELETE; export and
deletion isolation; next-request all-session revocation and password-reset
revocation; old Calendar URL invalidation; bounded analytics and safe
auth/mail/feedback logging; shared limiter persistence, concurrent admission,
expiry/retry and rejection of hosted production/preview E2E bypasses. Tests use
migration-backed PGlite. Ordinary browser auth throttling is intentionally
bypassed in the isolated harness; actual throttling is tested through auth
handlers in separate shared-store integration tests.

## Design checks and component choices

Automated Chromium checks exercise both themes, 320/390/768/1440px, enlarged root
text and reduced motion; keyboard submission/retry, skip-link activation,
password-to-DELETE and cancellation focus, drawer dismissal/focus restoration.
Screenshots of Settings' final confirmation and the revised privacy notice at
390px, plus the Private owner preview at 320px, were visually inspected in both
themes: readable wrapping, visible focus and no clipped actions. These are
automation and screenshot inspection, not a
complete manual keyboard or assistive-technology review.

Unavailable: VoiceOver/other screen-reader names and announcements, true browser
200% zoom, physical touch/sticky hover, mobile software keyboard and exhaustive
manual Tab traversal. No new motion or component was introduced. The notice
extends its existing native article/section paragraphs; AuthForm is the closest
auth composition but does not fit a static notice. The drawer story reuses the
existing ListCreationDrawer and Base UI lifecycle. Existing Settings controls,
stories and catalog production exclusions are unchanged.

## Blocking and operator gates

**Google deletion acceptance is blocked.** Google's
[security bundle](https://developers.google.com/identity/siwg/security-bundle#authentication_time)
states that Google Account reauth requests are unsupported; its
[OIDC table](https://developers.google.com/identity/openid-connect/openid-connect#authenticationuriparameters)
omits `login`/`max_age`. Claims require a verified/published app and Session age
claims enabled, neither verified here. Parent/owner must agree a supported fresh
authentication approach and obtain controlled nonproduction evidence before
accepting Google deletion. Do not weaken freshness or count mock tokens as proof
of provider compatibility. See `account-security-verification.md` for the checks.

All dated operator gates in `security-operations.md`,
`security-browser-verification.md` and `auth-rate-limiting.md` remain pending:
deployed HTTPS/cookies/origins/proxy/limiting/CSP compatibility, telemetry and
hosting/provider log exposure, access/MFA/environment separation, alerts,
retention, isolated restore and incident response. Keep CSP report-only. The
owner supplied `memorebo.dev@gmail.com` is published; contact delivery,
monitoring/escalation and Feedback notification routing remain unverified.
Local passing checks do not authorize operational sign-off or ticket closure.
