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
implementation fixes and self-review; no new independent reviewer was run.

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
