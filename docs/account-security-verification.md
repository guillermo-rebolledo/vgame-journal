# Account security verification (#134)

## Application policy

Deletion requires the current signed-in account to authenticate again using Better Auth's server password verification API or its Google authorization-code flow. A normal sign-in, session refresh, URL query marker, or typed DELETE does not issue a deletion proof.

Google starts from an authenticated session, binds the initiating account and start time in Better Auth's server-controlled OAuth state, and sends `prompt=login`, `max_age=0` and an essential `auth_time` claim request on the server. These parameters do **not** establish working Google reauthentication; see the blocking provider finding below. The installed Google provider's ID-token verifier checks signature, issuer, audience and expiry before its profile reader is used. Deletion additionally requires a numeric `auth_time` at or after the request start. Missing/stale evidence, provider failure and a different returned account cannot issue a proof. The callback only authorizes the final typed confirmation; it never deletes an account. The account chooser or consent screen alone is insufficient.

Proofs use the existing verification table, keyed by deletion purpose and server session ID, with the account ID as value. No bearer proof is exposed to JavaScript, URLs, analytics or application logs. Expiry is at most five minutes after password verification or the Google flow's start. A single PostgreSQL statement consumes a matching unexpired proof and deletes the account; concurrent consumption has one winner. A failed statement rolls both operations back. Existing foreign-key cascades remove server sessions and Journal data; reset and remaining deletion verifications are cleaned up in that statement. There is no migration or parallel session store.

Settings calls Better Auth `revokeSessions` to revoke every device, including current, then `signOut` to clear browser cookies and redirects to sign-in. `emailAndPassword.revokeSessionsOnPasswordReset` is explicitly enabled: successful reset invalidates every existing session, does not automatically sign in, and requires the new password. Integration tests exercise independently created sessions through the actual auth APIs.

## Local evidence and boundaries

- Migration-backed PGlite tests cover fresh password verification, missing/wrong account/session proof, typed confirmation, cancellation, expiration, concurrent consumption/replay, all-session revocation and password-reset revocation.
- Google tests use a local RSA key and mocked Google token/JWKS HTTP responses. They exercise the real Better Auth handler/state and ID-token verifier, fresh/missing/stale authentication evidence, forged signatures, cancellation and account mismatch. They do **not** verify a real Google round trip or Google's handling of prompt/max_age/auth_time.
- Playwright exercises the real Settings server actions, password failure and retry, cancellation, proof expiration, final typed deletion and next-request rejection from a second signed-in browser context. The existing export/deletion journey verifies cascades and another account's isolation.
- Stories exercise embedded form pending, failure/retry and final confirmation. Existing privacy/export links and catalog deployment exclusions remain intact.

## Google compatibility finding (blocking, 2026-11-09)

Google's primary [security bundle documentation](https://developers.google.com/identity/siwg/security-bundle#authentication_time)
explicitly states that Google Account reauth requests are unsupported. Its
[OIDC parameter table](https://developers.google.com/identity/openid-connect/openid-connect#authenticationuriparameters)
lists `none`, `consent` and `select_account`, omits `login` and `max_age`, and
requires an explicit `claims` request for `auth_time`. The security bundle also
requires a published, verified app with Session age claims enabled; configuration
here is unverified. #137 adds the missing essential claim request, with a failing
then passing handler regression. It does not solve forced reauthentication.

**Google deletion acceptance remains blocked.** The current request is not a
documented way to force fresh Google credentials. Mocked fresh tokens demonstrate
proof enforcement only. Keep refusing missing/stale evidence; do not replace it
with token issuance time, session refresh, consent or account selection. A parent
and owner decision on a supported fresh-authentication approach is required,
followed by controlled nonproduction evidence; no live Google check was performed.

## Required operator Google check (pending after compatibility resolution)

Use a disposable nonproduction Google-linked account and configured OAuth credentials; do not record tokens, cookies, codes or email addresses in evidence.

1. After resolving the unsupported forced-reauthentication approach above, keep an existing Google browser session open. Start Confirm with Google in Settings. Verify actual credential or equivalent fresh authentication occurs, rather than accepting an account chooser or consent alone. Verify the supported request and validated fresh authentication evidence. Record app verification and Session age claims configuration if the replacement still uses `auth_time`. If fresh evidence is unavailable the app must refuse deletion; do not weaken the check to make it pass.
2. Cancel and repeat with a different Google account. The original account and its export must remain accessible; typed deletion must not be authorized. Retry with the correct account.
3. Confirm that returning successfully only reveals typed DELETE. Cancel this final step and verify the Journal remains. Repeat and wait over five minutes: deletion must fail safely and offer authentication again.
4. Reauthenticate, type DELETE, and delete the disposable account. Confirm its profile/export/Calendar feed and every existing device session stop working. Retrying the prior request must not authorize deletion again.
5. Record dated pass/fail evidence and operator identity in the integration PR. A mocked callback is not completion evidence for this check.

## Design manual checks (pending unless recorded by an operator)

Automated focus assertions and accessibility scans supplement these checks:

- Keyboard-only reachability, visible focus, skip link, password-to-confirmation focus, cancellation focus and error recovery.
- VoiceOver names, heading navigation, password errors, identity confirmation and pending/success announcements.
- Both themes at 320, 390, 768 and 1440px; 200% zoom and enlarged text; software keyboard on a physical phone; no lost actions or horizontal page scrolling.
- Reduced motion, touch without sticky hover, pending, error and retry states.

No production account access, secret rotation or live destructive check was performed.

## Local validation (2026-11-09)

Historical slice results follow. Combined #137 results and the reproduced/fixed
drawer-story closing-state race are recorded in `security-acceptance.md`.

- Based on integration `4eefa97f9c182361ad2588a1b3497edad59175c5`; merged the newer integration work, preserving #133's database limiter, trusted-IP/E2E guard and migration 0016, plus #135's headers/redaction and privacy links.
- `pnpm lint` and `pnpm typecheck`: passed after integration merge.
- `pnpm test`: 45 files / 551 tests passed after integration merge, including nine proof/password/Google callback cases and all session/reset tests.
- `pnpm test:e2e e2e/account-security.spec.ts e2e/journal.spec.ts e2e/auth.spec.ts e2e/accessibility.spec.ts --workers=2`: 32 passed after integration merge; the production-mode app build also passed.
- `pnpm test:storybook`: initial run 194 passed. Later full runs reported 193 passed / one failure in the unchanged `Product/List creation drawer/Bottom Browser Toolbar` story: Base UI focus guards produced `aria-hidden-focus` during the accessibility scan. Focused reruns of that drawer and both changed form story files passed all 14 tests. This intermittent full-suite failure is retained as a limitation, not suppressed or fixed in an unrelated component.
- `pnpm build-storybook`: passed after integration merge (upstream bundler/docgen warnings).
- Automated reflow checks passed for Settings at 320, 390, 768 and 1440px with 200% root text size, both themes and reduced motion. The final confirmation state passed axe and keyboard focus assertions; 390px full-page screenshots in both themes were visually reviewed without clipped actions. Root text scaling is not a physical-browser zoom or software-keyboard check.
- Still pending: real Google round trip, VoiceOver, physical-device/touch/software-keyboard checks and full manual keyboard/zoom review. No claim of production verification is made.
