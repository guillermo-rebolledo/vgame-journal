# Final code-review findings for #130 / PR #138

2026-11-09. Implementation starts at `37951337bbd187dfa6e7164a2d009c7740ba5e61`, confirmed as an ancestor of this branch. Standards and Spec findings below are the supplied final reviews, not a newly commissioned review. No baseline smells or additional scope-creep findings were reported.

## Standards review: one P2

| Before | After | Why / evidence |
| --- | --- | --- |
| P2: deletion changed its action label while pending; password/cancel/sign-out-all relied on decorative Button loading without the stable status owner required by DESIGN.md. | Preserve visible labels and compose one stable output per flow, covering confirming, sending, cancelling, deleting and signing out. Reuse DeleteAccountForm/SignOutAllForm and existing Button/Input/Label; AuthForm was the closest general form, but its sign-in responsibility does not fit embedded Settings deletion. | Pending stories failed on missing/wrong status and changed deletion label, then passed with stable-label/one-status assertions. Code entry, cancellation and delivery retry also have stories. |

## Spec review: three P1

| Finding | Fix | Evidence |
| --- | --- | --- |
| P1: direct `auth.api.getSession` in currentSession/proxy bypassed handler/fetch protection; APIError.cause retained database SQL/params for Next logging. | Protect every direct API endpoint on createAuth's API object. Unexpected/5xx failures become a fresh fixed APIError without cause. Intended client errors retain status/message/code and headers, without carrying the original error object. Handler/fetch protection remains. | Direct real-auth session test injected a database sentinel and failed with the sentinel in hidden cause/body. It now passes; existing auth failure, password and OAuth redirect tests verify intended behavior. |
| P1: feedback executeBatch persistence rejection escaped through the user-menu action with message/path params. | Catch persistence errors at the feedback service boundary and return a fixed retry error without cause. Do not send mail or report success after failed persistence. Existing form error handling preserves the draft. | Synthetic database persistence sentinel test rejected before the change; now returns only the fixed error, sends no success notification and permits retry. Existing feedback component/browser stories cover retained drafts and retry. |
| P1: unsupported forced Google reauthentication could not establish provider freshness. | Implement the owner-approved verified-email code followed by typed DELETE; remove custom OAuth state/hooks/provider verification scaffolding and mock auth_time tests. Preserve ordinary Google sign-in. | Initial email integration failed because sendCode did not exist, then passed through real auth APIs, local mailbox and database. Failure/cancel/expiry/replay/mismatch/limits/concurrency cases pass. Local browser journeys use actual Settings actions and Resend SDK HTTP calls, including failed delivery and retry. |

An additional red/green check at the agreed proof seam showed readiness still accepted a proof after revoking the initiating session. Readiness and atomic final deletion now check that session is live. The deletion statement also removes the new account-bound verification records; lifecycle fixtures now use real session rows.

## Verification boundaries

See `security-acceptance.md` for final command results. No independent post-fix reviewer was run. Live mail delivery, deployed ordinary Google sign-in, production HTTPS/cookies/origins/proxy/logging/limiting, access/MFA, retention and restore safeguards require dated operator evidence. No production send, remote provider configuration, secret access, push, PR creation or issue status change occurred.
