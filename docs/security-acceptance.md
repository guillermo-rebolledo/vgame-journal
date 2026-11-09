# Integrated security acceptance (#130 / PR #138)

Updated 2026-11-09 for the final review corrections and the [owner-approved
Google-only deletion replacement](https://github.com/guillermo-rebolledo/vgame-journal/issues/130#issuecomment-6748746649).
Started clean on branch `t3/597bafb4` at integration
`37951337bbd187dfa6e7164a2d009c7740ba5e61`; ancestry was confirmed. Work stays
in this one branch/worktree without subagents, pushing, creating a PR, changing
issue state or marking operational safeguards ready. The final fetch/merge of
`origin/feat/account-security-privacy-130` reported already up to date at the same
integration SHA. Final local branch: `t3/account-deletion-review-fixes`.

## Final behavior and review fixes

- Google-only deletion uses a one-use code to the verified account address,
  server-derived from a live session/account. Confirmation binds account,
  initiating session and deletion purpose and retains the original five-minute
  expiry. Three send attempts per account/hour and five attempts per code are
  enforced in the existing verification store. Failed mail never confirms
  identity and permits bounded retry. Code confirmation cannot delete; typed
  DELETE remains final. Password accounts retain Better Auth password proof.
- Removed unsupported forced Google OAuth reauthentication hooks, custom provider
  auth_time checks, callback markers and mocked-provider tests. Ordinary Google
  sign-in uses the installed provider. The previous Google deletion design
  blocker is superseded by the owner decision; no mock is deployment evidence.
- Every direct server auth API call is protected, including session lookup in
  currentSession/proxy and Settings methods. Database/5xx failures become a
  fixed cause-free error before Next receives them; intended client errors and
  redirects retain their behavior. Existing handler/fetch/log protections remain.
- Feedback persistence failures return a fixed retry error without database
  message/path params or nested causes, send no success notification and preserve
  the existing editor draft/retry behavior.
- Delete and sign-out actions keep their labels while pending and each flow owns
  one stable status output. Stories assert confirming, sending, cancelling,
  deleting and signing-out feedback. Readiness and final deletion also reject
  already-confirmed proofs after initiating-session revocation.
- Account deletion cleans new challenge/send-budget records as well as the
  existing cascades and proof/reset records. No schema migration, session store,
  production dependency or new tracking event was added. The privacy notice now
  includes deletion confirmation in the Resend email purposes.

The supplied Standards review had one P2 and the Spec review had three P1s.
`security-review.md` records them separately, with red/green evidence. These are
implementation fixes. A focused independent follow-up confirmed those fixes and
identified the cancellation race corrected below.

## Final cancellation-race verification

The parent reproduced the focused review's additional P2 using the actual
account-security module and two connections to disposable local PostgreSQL 17.
Confirmation paused after updating the challenge; cancellation was observed
waiting on its lock. Before the fix, cancellation returned success but the proof
remained usable. Shared session-row locking and a fresh cancellation statement
snapshot make the same test pass, including ten repeated executions. The first
repeat attempt retained the harness's send-budget records; fixture cleanup was
corrected before the clean repeated run. No Neon/production database was used,
and the disposable container was stopped and removed after verification.

`pnpm test src/lib/account-security.test.ts src/lib/feedback.test.ts src/lib/lists.test.ts --maxWorkers=2 --testTimeout=30000`
passed all 46 tests covering the changed batch helper's callers. The existing
PGlite proof seam now includes concurrent confirmation/cancellation; PGlite's
serialized transactions do not reproduce the two-connection snapshot anomaly.
`pnpm lint`, `pnpm typecheck` and `git diff --check` passed.
The final full `pnpm test --maxWorkers=2 --testTimeout=30000` run passed all
46 files / 565 tests after this correction (110.39s).

`E2E_PORT=3390 E2E_SUPPORT_PORT=3391 pnpm test:e2e e2e/account-security.spec.ts e2e/feedback.spec.ts e2e/custom-lists.spec.ts --workers=2`
passed all 11 affected browser journeys and the production-mode app build after
the cancellation fix. The 204-story build/test and 53-journey acceptance results
above precede this SQL-only correction; no production UI or motion changed.

## Automated acceptance

Dependencies: `pnpm install --frozen-lockfile`. All tests use migration-backed
PGlite or the isolated local support server. Browser builds run with empty remote
DB/Google/Twitch credentials and local Resend SDK HTTP routing. No production
mail send, remote provider configuration or secret access was performed.

| Command | Final result |
| --- | --- |
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed |
| `pnpm test --maxWorkers=1 --testTimeout=30000` | 46 files / 564 tests passed (406.24s) |
| `pnpm test:storybook --maxWorkers=2` | 42 files / 204 stories passed |
| `pnpm build-storybook` | Passed; upstream directive/docgen warnings |
| Selected production-mode Playwright command below | 53 passed in one run (4.3m), including the production app build |
| `git diff --check` | Passed |

```sh
E2E_PORT=3290 E2E_SUPPORT_PORT=3291 pnpm test:e2e e2e/profile-visibility.spec.ts e2e/account-security.spec.ts e2e/journal.spec.ts e2e/auth.spec.ts e2e/privacy.spec.ts e2e/security-headers.spec.ts e2e/accessibility.spec.ts e2e/custom-lists.spec.ts e2e/custom-lists-public.spec.ts e2e/feedback.spec.ts --workers=2
```

Focused red/green runs reproduced both raw error escapes, absent email confirmation
and missing/incorrect pending announcements before their fixes. A further proof
regression failed on session revocation, then passed. Final focused proof/Journal
run: 62 tests passed. Affected stories: 10 passed after correcting the retry
fixture's per-story mock reset and pending cleanup. The first typecheck exposed
a story callback inferred too narrowly; its explicit result type was corrected
and typecheck passed. The initial seven account-security browser journeys passed
before the final broader run. The final unit run emitted existing Node
timer-overflow/deprecation and jsdom navigation warnings; no tests failed.

Coverage includes password and verified-email proof failure, cancellation,
expiry, replay, wrong account/session, concurrency, bounded sends/attempts,
unverified email, failed delivery/retry and session revocation; final typed
confirmation, export/deletion isolation, Lists/Calendar cascades, all-device and
password-reset revocation; visibility/public-field exclusion; auth throttling,
analytics redaction, safe auth/mail/feedback errors, accessibility and existing
editor recovery. Ordinary auth throttling remains intentionally bypassed only in
the isolated E2E harness; separate auth integration tests enable the shared limiter.

## Design evidence and limits

The existing DeleteAccountForm/SignOutAllForm compositions extend Settings with
Button, Input and Label. AuthForm was the closest general form but serves sign-in,
not embedded destructive confirmation. The same components and stable outputs
cover password/code and final confirmation; no new motion was added. DESIGN.md
and colocated stories document the states. Catalog output and imports remain
local/CI-only.

Chromium automation exercises keyboard submission and focus restoration,
password/code-to-DELETE focus, cancellation, both themes, widths
320/390/768/1440, 200% root text, reduced motion and axe. Email reading does not
navigate or delete: the code-only mail has no credential link. Google-only
fixtures replace a synthetic credential account with a Google provider account;
they verify the application email flow, not Google OAuth or live delivery.

The 390px email-code and typed-DELETE screenshots were visually inspected in both
themes: readable wrapping, visible focus and no clipped actions. VoiceOver,
physical touch/sticky hover, mobile software keyboards, true browser zoom and
exhaustive manual Tab traversal remain unavailable. Automation is not full
assistive-technology or physical-device certification.

## Main merge verification

Merged `main` at `eb52650130f9e6522bb726c70e2c3bcda7438230` into the integration
branch to resolve PR #138's conflicts. Main's deployed feedback migrations 0016
and 0017 and their snapshots are unchanged. The security schema is regenerated
as `0018_account_security_privacy.sql`, retaining the existing-account Public
backfill and new-account Private default. A second `pnpm db:generate` reports no
schema changes. Migration-backed tests cover both feedback and visibility.

The merge preserves main's feedback session channel, first-save invitation,
SupportLink, safe pathname normalization and atomic Journal transactions, plus
this PR's footer privacy link, bounded telemetry values/routes and safe database
failure boundary. Privacy uses main's existing SUPPORT_EMAIL setting rather than
duplicating the address. Existing Link/SupportLink components fit the combined
footer; no product component or interaction was introduced.

- `pnpm lint` and `pnpm typecheck`: passed.
- `pnpm test --maxWorkers=2 --testTimeout=30000`: 47 files / 595 tests passed.
- `pnpm test:storybook --maxWorkers=1`: 44 files / 211 tests passed.
- `pnpm build-storybook`: passed.
- The 70-journey security/privacy/feedback/Home/atomicity/List run passed 67
  tests and identified three duplicate-locator failures against Next's hidden
  prerendered profile notice. Scoping those assertions to the main landmark
  preserves their visible behavior contract. The final full accessibility and
  profile rerun passed all 13 tests; all 70 selected journeys have passing
  evidence across these runs, including the production-mode builds.
- The drawer Visible Viewport story initially finished during its closing
  transition and failed axe on temporary Base UI focus guards. It now waits for
  actual dismissal and restored trigger focus before resetting viewport mocks.
  Its six repeated executions and the complete Storybook suite pass. No
  production drawer behavior or accessibility rule was changed.

Browser commands used isolated ports 3490/3491 and the synthetic support server:
`pnpm test:e2e e2e/profile-visibility.spec.ts e2e/account-security.spec.ts e2e/journal.spec.ts e2e/journal-atomicity.spec.ts e2e/auth.spec.ts e2e/privacy.spec.ts e2e/security-headers.spec.ts e2e/accessibility.spec.ts e2e/custom-lists.spec.ts e2e/custom-lists-public.spec.ts e2e/feedback.spec.ts e2e/home-save.spec.ts --workers=2`,
then `pnpm test:e2e e2e/accessibility.spec.ts e2e/profile-visibility.spec.ts --workers=2`.
No new physical-device, screen-reader, true browser zoom or production/provider
checks were performed for this merge; the operator gates below remain pending.

## CI E2E follow-up

CI run `42686175259` on `c8a6804` failed all three Chromium shards. The exact
failures were reproduced locally: Public List's previous label, an unscoped Save
button after adding Profile visibility, and the new Privacy link's background
router prefetch counted as a shelf request. The run also exposed an order-dependent
feedback fixture: its raw first-insert query returned no rows when Celeste had
not already been loaded into the local Catalog by another test.

The four E2E specs now use the current List label, scope Region controls to their
form, exclude only requests carrying Next's router-prefetch marker from the
local shelf-fetch assertion, and explicitly load Celeste before simulating the
old-version Journal insert. The feedback case uses the existing unique-account
helper and passes alone on a fresh support database. The first fix run caught a
missing helper import, which was corrected before final verification. No app
behavior, retry policy, assertion timeout or CI configuration changed.

Focused command (isolated ports 3590/3591):
`pnpm test:e2e e2e/custom-lists-owner.spec.ts e2e/game-facts.spec.ts e2e/tag-shelves.spec.ts e2e/feedback.spec.ts --grep 'an empty public list|headline board|tag shelves switch|unclaimed old' --workers=2`.
All four cases passed together (11.2s); the feedback case also passed alone.
`pnpm lint` and `pnpm typecheck` also pass. The new CI run is the full-suite
verification; its result must be read independently of the earlier selected
local acceptance runs.

## Operator gates remain pending

Live mail delivery/domain authentication and deployed ordinary Google sign-in
require controlled nonproduction evidence. All operator gates in
`security-operations.md`, `security-browser-verification.md` and
`auth-rate-limiting.md` remain pending: HTTPS/cookies/origins/proxy/limiting/CSP,
telemetry and hosting/provider logs, access/MFA/environment separation, alerts,
retention, isolated restore and incident response. Keep CSP report-only. The
owner-supplied contact is published; delivery, monitoring/escalation and Feedback
notification routing remain unverified. Local checks do not authorize operational
sign-off or issue closure.
