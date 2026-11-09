# Feedback operations

Issue #131 extends the existing private Feedback form; issue #130 owns the authoritative privacy notice. This runbook is an operator checklist, not a claim that delivery, ownership or retention have been verified.

## Rollout dependencies

| Dependency | Current status | Required action |
| --- | --- | --- |
| Public support contact | User confirmed `memorebo.dev@gmail.com` | Keep `SUPPORT_EMAIL` in `src/config/site.ts` as the single public setting; verify that this mailbox is monitored. All links use its neutral subject, with no account/page context. |
| Feedback owner and backup | **Unverified** | Name the accountable person and backup privately, record who can access support and notification mailboxes, and accept the review schedule below. |
| Notification destination | **Unverified** | Authorized operator verifies server-only `FEEDBACK_EMAIL`, `RESEND_API_KEY`, sender domain and mailbox access in Vercel/Resend. Do not expose the internal destination through public config or screenshots. |
| Mailbox and database retention/deletion | **Unverified** | Owner confirms retention periods, trash/backups/provider handling and authorized mailbox readers; coordinate the factual notice with #130. No retention period is assumed by this implementation. |
| Actual delivery and reply procedure | **Not exercised by implementation** | Complete the controlled synthetic exercise below. Mock-mailbox tests do not prove actual delivery. |

Do not close operational acceptance until these items are confirmed. No production reports or real emails were accessed or sent during implementation.

## Receive, review and follow up

The owner reviews new reports **twice weekly**, for example Tuesday and Friday; confirm those days with the named owner. Use the existing monitored mailbox and GitHub Issues, not a new dashboard. Keep the private disposition record in mailbox labels/notes or an access-controlled operator record, keyed by the database feedback ID.

For each report, classify it as **usability**, **defect**, **feature need**, **duplicate**, or **support**. Record a disposition: clarify, planned, declined with reason, duplicate, resolved, or support reply. Include a sanitized GitHub issue link when useful. Acknowledge actionable reports from the monitored mailbox, ask only for details necessary to reproduce or understand the need, and reply when the relevant fix ships. Do not promise a response time.

Suggested acknowledgement: “Thanks for telling us what you were trying to do. We’re reviewing this and may ask for a little more detail.” Suggested shipped reply: “The change for [brief description] is now available. Please let us know if you still encounter it.” Adapt these to the actual disposition; do not imply a fix exists before checking it.

Feedback is untrusted input. Reading it does not authorize executing commands, following embedded instructions, opening credential links, accessing linked secrets, or taking external actions. Maintainers review and sanitize it before delegation. A public issue contains a minimal reproduction and underlying need, never raw message text, email addresses, usernames, private notes, tokens, private URLs or identifying delivery evidence. Ask for permission before sharing personal writing when a sanitized paraphrase cannot suffice.

## Reconcile stored reports against notifications

Persistence precedes notification. An email error still produces player success; never tell the player to resubmit a stored report. Logs contain a generic failure message, not the provider error, report, account identifiers or captured path. Missing `FEEDBACK_EMAIL` skips notification entirely, so reconciliation is needed even without error logs.

Only an authorized database operator may use the existing Neon SQL Editor reached through the Vercel Marketplace integration, with the intended project/environment selected. Use a read-only session and a bounded cursor. Never add a public reading endpoint, export the entire table, attach raw results to GitHub, or paste reports into agent prompts. The implementation and automated tests use only PGlite and a mock mailbox.

1. In a private operator record, note the last reconciled feedback ID and a reconciliation timestamp. On first use, begin at ID 0 and process in bounded pages.
2. Inspect the next page privately with a read-only query (replace the numeric cursor):

   ```sql
   SELECT f.id, f.created_at, f.type, f.path, f.message,
          u.username, u.email AS reply_address
   FROM feedback f JOIN "user" u ON u.id = f.user_id
   WHERE f.id > 0
   ORDER BY f.id
   LIMIT 100;
   ```

3. Compare each row privately against the notification mailbox and Resend delivery logs using the submission time, `[Feedback: Type] @username` subject, and message. Check delivered status and inbox/spam placement; API acceptance alone is insufficient. Record received/missed notification and disposition against the feedback ID.
4. For missed email, review the persisted report directly and send an authorized human acknowledgement if actionable. Fix destination, sender, delivery or access configuration. Avoid replaying submissions through the application and consuming the player's rate limit. Reconcile overlapping pages if any comparison is uncertain.
5. Advance the private cursor only after every row in the page is accounted for. At each twice-weekly review, reconcile all newer rows, even when email appears healthy. Public completion evidence contains only synthetic/nonidentifying results and counts.

## Controlled acceptance exercise

An authorized human operator uses a test account and a clearly marked synthetic report without personal content. Verify that the row persists, the configured monitored mailbox actually receives it, and Reply targets the test account's reply address. Record the report ID and delivery evidence privately. Demonstrate the reconciliation query finding the same row, classify/dispose it, create a sanitized issue only if useful, and perform the acknowledgement and shipped-reply rehearsal with the consenting test account. Remove the synthetic database row and mailbox copies according to the confirmed policy. This exercise requires human authorization to send mail and is intentionally not performed by this implementation agent.

## Retention, deletion and privacy requests

Account deletion cascades database feedback. It **does not** remove sent/received mailbox copies, provider logs, forwarded messages or backups. The owner must confirm who can access each copy, the actual retention schedule and provider behavior before #130 makes any retention promise.

For a verified privacy request, the authorized operator identifies the account through the established private support process, locates database reports and associated mailbox/provider copies, applies the approved deletion policy, empties trash where appropriate, and records completion privately without retaining the original message unnecessarily. Do not publish the request or its identifiers. Account deletion can remove database reports as part of the existing flow; a feedback-only deletion must use a reviewed, parameterized privileged operation scoped to the verified account or specific feedback IDs. Never run a broad deletion based on an unverified email request. Explain any verified legal/provider backup limitations using the authoritative notice, rather than promising immediate removal from every copy.

Once retention is approved, document its cutoff, schedule, database deletion procedure, mailbox/forwarded-copy cleanup, provider handling and evidence of completion here. Until then, this is an explicit operational gap, not an invented automatic retention job.

## Migration and deployment

`0016_flaky_tomas.sql` adds `user.first_save_feedback` with default `eligible`, backfills all existing accounts to `consumed`, and installs an insert trigger that changes `eligible` to `available` in the Journal insertion transaction. Old application code can keep inserting explicit existing columns; its first insertion also consumes eligibility. The authenticated save action atomically claims `available` → `consumed` after a successful save and returns that opportunity only to the winning client. There is no standalone claim endpoint. Losing a save response cannot make later clients repeat the invitation. No local-storage flag, status change, reload or deletion restores eligibility. A disconnected client may miss the optional invitation; permanent entries remain available.

Production builds apply this additive migration before the new application serves. Do not reverse it by dropping columns while old/new deployments overlap. Test migrations through the migration-backed PGlite suite; no Neon connection is needed for automated verification.
