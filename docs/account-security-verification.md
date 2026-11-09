# Account security verification (#134)

Updated 2026-11-09 for the [owner decision in #130](https://github.com/guillermo-rebolledo/vgame-journal/issues/130#issuecomment-6748746649), also recorded in #134.

## Application policy

Password accounts use Better Auth's `verifyPassword` API before typed DELETE. Google-only accounts instead request a fresh eight-digit email code sent to the **verified account address**, read from the live account/session records on the server. No local password, caller recipient, forced Google reauthentication, `auth_time`, `prompt=login`, or `max_age` is involved. Ordinary Google sign-in uses the installed Better Auth provider unchanged.

The installed Better Auth email OTP plugin uses email and sign-in/verification/recovery purposes; it does not supply this deletion-purpose and initiating-session binding. The deletion service therefore extends the existing Better Auth verification table and existing mail service with conditional PostgreSQL writes, using the existing Neon/PGlite batch adapter. It adds no session store, migration, dependency or generic OTP endpoint.

Codes are stored as SHA-256 digests, bound to account, initiating server session and deletion purpose, and expire within five minutes of creation. Only a successfully completed mail-service call enables code confirmation. A per-account database budget admits at most three send attempts per hour, including failed deliveries; cancellation and new sessions do not reset it. Each code permits at most five verification attempts. Reissuing replaces the prior code. No recipient, code or proof is returned in action results or placed in URLs, logs or analytics.

Code confirmation atomically consumes the matching delivered challenge and creates a server-only deletion proof with the **original** expiry. It does not extend the five-minute window or delete anything. There is no email link to open. Typed DELETE remains the final action. Readiness and final deletion require the initiating session to remain live; revocation/reset invalidates authorization. One database statement consumes the proof and deletes the account, with one winner under concurrency and rollback on persistence failure. Cascades remove sessions and Journal/Lists/feedback; related reset tokens, deletion proofs, challenges and send budgets are removed. Other accounts and Catalog data remain intact.

Settings revokes all server sessions through Better Auth before signing out and returning to sign-in. Password reset explicitly revokes every existing session and requires signing in again.

## Local evidence

- Narrow migration-backed PGlite integration tests exercise real Better Auth APIs and the deletion service: password proof; verified-email recipient; wrong account/session; no deletion before typed confirmation; wrong final text; expiry; cancellation; replay; bounded concurrent send/verification; failed mail followed by safe retry; unverified email; revoked session before/after proof; rollback and account preservation.
- The local production-mode browser harness uses the real Settings actions, Resend SDK HTTP API and isolated mailbox. Google-only fixtures replace the synthetic credential account with a Google provider account; this is **not Google OAuth deployment verification**. Journeys cover code delivery, keyboard focus/submission, cancellation, wrong/expired code, failed mail retry and final deletion. Password/reset/sign-out/export/Lists lifecycle journeys continue to run.
- Stories exercise stable action labels, exactly one stable status output per flow, password/code retry, delivery failure, sending/confirming/cancelling/deleting/signing-out pending states, and final typed confirmation.
- Final command results are recorded in `security-acceptance.md`; review findings and red/green evidence are in `security-review.md`.

## Required operator evidence (pending)

The owner decision replaces the unsupported Google forced-reauthentication requirement; there is no remaining Google deletion design blocker. Local mocks do not establish live delivery or deployed security.

Use disposable nonproduction accounts and approved operator access, without recording addresses, codes, cookies or tokens:

1. Verify real mail delivery to the account's verified address, sender authentication, spam handling and provider rejection/retry. Confirm that reading the email cannot delete data.
2. Enter the code in the initiating session, then cancel typed DELETE. Repeat with expiry, replay, a different session/account and session revocation. All must preserve data.
3. Confirm code plus typed DELETE deletes only the intended disposable account and invalidates its profile/export/Calendar feed and every existing session.
4. Verify ordinary Google sign-in still works in the configured deployment. No special Google reauthentication or Session age claims configuration is needed for deletion.
5. Record deployment SHA, date, operator and sanitized results. Follow the remaining access, logging, retention and restore gates in the operations runbooks.

## Design limitations

Chromium automation covers keyboard submission/focus, both themes, widths 320/390/768/1440, enlarged root text, reduced motion and accessibility scans. Screenshot inspection supplements those checks. VoiceOver announcements, physical touch/sticky hover, a real mobile software keyboard, true browser zoom and exhaustive manual keyboard traversal remain pending. No production mail, remote configuration or secrets were accessed.
