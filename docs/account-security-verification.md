# Account security verification (#134)

## Application policy

Deletion requires the current signed-in account to authenticate again using Better Auth's server password verification API or its Google authorization-code flow. A normal sign-in, session refresh, URL query marker, or typed DELETE does not issue a deletion proof.

Google starts from an authenticated session, binds the initiating account and start time in Better Auth's server-controlled OAuth state, and forces `prompt=login` and `max_age=0` on the server. The installed Google provider's ID-token verifier checks signature, issuer, audience and expiry before its profile reader is used. Deletion additionally requires a numeric `auth_time` at or after the request start. Missing/stale evidence, provider failure and a different returned account cannot issue a proof. The callback only authorizes the final typed confirmation; it never deletes an account. The account chooser or consent screen alone is insufficient.

Proofs use the existing verification table, keyed by deletion purpose and server session ID, with the account ID as value. No bearer proof is exposed to JavaScript, URLs, analytics or application logs. Expiry is at most five minutes after password verification or the Google flow's start. A single PostgreSQL statement consumes a matching unexpired proof and deletes the account; concurrent consumption has one winner. A failed statement rolls both operations back. Existing foreign-key cascades remove server sessions and Journal data; reset and remaining deletion verifications are cleaned up in that statement. There is no migration or parallel session store.

Settings calls Better Auth `revokeSessions` to revoke every device, including current, then `signOut` to clear browser cookies and redirects to sign-in. `emailAndPassword.revokeSessionsOnPasswordReset` is explicitly enabled: successful reset invalidates every existing session, does not automatically sign in, and requires the new password. Integration tests exercise independently created sessions through the actual auth APIs.

## Local evidence and boundaries

- Migration-backed PGlite tests cover fresh password verification, missing/wrong account/session proof, typed confirmation, cancellation, expiration, concurrent consumption/replay, all-session revocation and password-reset revocation.
- Google tests use a local RSA key and mocked Google token/JWKS HTTP responses. They exercise the real Better Auth handler/state and ID-token verifier, fresh/missing/stale authentication evidence, forged signatures, cancellation and account mismatch. They do **not** verify a real Google round trip or Google's handling of prompt/max_age/auth_time.
- Playwright exercises the real Settings server actions, password failure and retry, cancellation, proof expiration, final typed deletion and next-request rejection from a second signed-in browser context. The existing export/deletion journey verifies cascades and another account's isolation.
- Stories exercise embedded form pending, failure/retry and final confirmation. Existing privacy/export links and catalog deployment exclusions remain intact.

## Required operator Google check (pending)

Use a disposable nonproduction Google-linked account and configured OAuth credentials; do not record tokens, cookies, codes or email addresses in evidence.

1. Keep an existing Google browser session open. Start Confirm with Google in Settings. Verify actual credential or equivalent Google reauthentication occurs, rather than accepting an account chooser or consent alone. Verify the request includes prompt=login and max_age=0 and the validated token supplies fresh auth_time. Google's published [OpenID Connect guidance](https://developers.google.com/identity/openid-connect/openid-connect) lists consent/account selection prompts; it does not establish that these parameters force credentials in this deployment. If fresh evidence is unavailable the app must refuse deletion; do not weaken the check to make it pass.
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
