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

Only an authorized database operator may use the existing Neon SQL Editor reached through the Vercel Marketplace integration, with the intended project/environment selected. Use a read-only session and bounded pages. Never add a public reading endpoint, export the entire table, attach raw results to GitHub, or paste reports into agent prompts. The implementation and automated tests use only PGlite and a mock mailbox.

1. Keep an access-controlled processed-ID record with notification outcome, disposition and reconciliation timestamp for each feedback ID. At **every** twice-weekly review, start a fresh full scan at ID 0. IDs are allocated before commit: a lower ID can become visible after a higher ID was already processed. Neither the highest ID nor a timestamp is a safe cross-review checkpoint.
2. Inspect bounded pages privately with the read-only query below. Replace `0` with the last ID **seen in this scan** to fetch the next page; continue until a page is empty. This cursor is only for paging within the current scan and must reset to 0 at the next review. Never export the table; inspect at most 100 rows at a time.

   ```sql
   SELECT f.id, f.created_at, f.type, f.path, f.message,
          u.username, u.email AS reply_address
   FROM feedback f JOIN "user" u ON u.id = f.user_id
   WHERE f.id > 0
   ORDER BY f.id
   LIMIT 100;
   ```

3. Compare each ID with the private processed-ID record. Skip completed IDs; reconcile unseen or incomplete IDs against the notification mailbox and Resend delivery logs using the submission time, `[Feedback: Type] @username` subject, and message. Check delivered status and inbox/spam placement; API acceptance alone is insufficient. Record received/missed notification and disposition against the feedback ID only after accounting for it. Retain incomplete work for retry; a page cursor never establishes that a report was processed.
4. For missed email, review the persisted report directly and send an authorized human acknowledgement if actionable. Fix destination, sender, delivery or access configuration. Avoid replaying submissions through the application and consuming the player's rate limit.
5. Finish each full scan even when email appears healthy. A lower ID that commits after its page was read is picked up by the **next unconditional full scan**, regardless of uncertainty or email failures. For example, if ID 41 is uncommitted when ID 42 is processed, the next review begins at 0, finds 41, and skips already-processed 42. If a review is interrupted, restart at 0 against the same private record. Public completion evidence contains only synthetic/nonidentifying results and counts.

## Controlled acceptance exercise

An authorized human operator uses a test account and a clearly marked synthetic report without personal content. Verify that the row persists, the configured monitored mailbox actually receives it, and Reply targets the test account's reply address. Record the report ID and delivery evidence privately. Demonstrate the reconciliation query finding the same row, classify/dispose it, create a sanitized issue only if useful, and perform the acknowledgement and shipped-reply rehearsal with the consenting test account. Remove the synthetic database row and mailbox copies according to the confirmed policy. This exercise requires human authorization to send mail and is intentionally not performed by this implementation agent.

## Retention, deletion and privacy requests

Account deletion cascades database feedback. It **does not** remove sent/received mailbox copies, provider logs, forwarded messages or backups. The owner must confirm who can access each copy, the actual retention schedule and provider behavior before #130 makes any retention promise.

For a verified privacy request, the authorized operator identifies the account through the established private support process, locates database reports and associated mailbox/provider copies, applies the approved deletion policy, empties trash where appropriate, and records completion privately without retaining the original message unnecessarily. Do not publish the request or its identifiers. Account deletion can remove database reports as part of the existing flow; a feedback-only deletion must use a reviewed, parameterized privileged operation scoped to the verified account or specific feedback IDs. Never run a broad deletion based on an unverified email request. Explain any verified legal/provider backup limitations using the authoritative notice, rather than promising immediate removal from every copy.

Once retention is approved, document its cutoff, schedule, database deletion procedure, mailbox/forwarded-copy cleanup, provider handling and evidence of completion here. Until then, this is an explicit operational gap, not an invented automatic retention job.

## Migration and deployment

`0016_flaky_tomas.sql` adds `user.first_save_feedback` with default `eligible` and backfills existing accounts to `consumed`. `0017_bind_first_save_transaction.sql` retires abandoned `available` states and replaces the insertion trigger. The trigger atomically changes `eligible` to `insert:<transaction ID>` when the first Journal entry is inserted. The authenticated save uses one database transaction (Neon HTTP batch, PGlite transaction in tests) for the upsert and a conditional consumption matching that transaction ID. Only that request returns the invitation. Concurrent insertions serialize on the account row; Status updates, deletion/re-addition and later saves cannot claim another transaction's opportunity.

Old application code can keep inserting explicit existing columns. Its first insertion also exhausts eligibility, but its later `available` claim cannot match the transaction-bound state. A process ending after commit or losing the response may miss the optional invitation permanently; permanent Feedback entries remain available. There is no standalone claim endpoint or recovery on later saves, reloads or another device. No column is removed or renamed.
Production builds apply this additive migration before the new application serves. Do not reverse it by dropping columns while old/new deployments overlap. Test migrations through the migration-backed PGlite suite; no Neon connection is needed for automated verification.

## Review-fix validation (2026-11-09)

The first-save result now comes from Journal persistence in the inserting transaction, including first Playthrough recording. The existing Feedback channel/editor and SupportLink are reused; no new UI component, form, motion or contact destination was introduced. SupportLink's existing native-link story passed its Tab-focus and neutral-destination assertions unchanged.

Passed checks:

- `pnpm test src/lib/journal.test.ts src/lib/feedback.test.ts src/components/home-journal.test.tsx --maxWorkers=2`: 82 tests. Includes concurrent first additions, an unclaimed old-version insertion followed by Status change and deletion/re-add, first Playthrough retry, migration backfill and retirement of abandoned legacy opportunities.
- `pnpm test --maxWorkers=2`: all 524 unit tests across 41 files passed. The run emitted nonfatal timeout-overflow warnings and a jsdom navigation message.
- `pnpm test:storybook src/components/support-link.stories.tsx`: 1 test.
- `pnpm test:storybook`: 193 tests across 41 files, including SupportLink keyboard focus.
- `pnpm build-storybook`: passed; existing Vite directive/docgen/bundle warnings remain nonfatal. Catalog output stays local and outside `public/`.
- `pnpm lint` and `pnpm typecheck`: passed.
- `E2E_PORT=3310 E2E_SUPPORT_PORT=3311 pnpm test:e2e e2e/feedback.spec.ts e2e/accessibility.spec.ts e2e/home-save.spec.ts --workers=2`: 25 tests passed against the production Next.js build, isolated PGlite and mock mailbox. Includes the new unclaimed-insertion regression, concurrent browser saves, Home first-save invitation, keyboard focus/return, rejected/offline drafts, both-theme accessibility, reduced motion and reflow at 320/390/768/1440px (Home also covers 200% text).

Visual review of the generated 320px light and 1440px dark Feedback screenshots found the Message field, disclosure and actions readable and within the viewport. Keyboard/focus, reflow and announcement assertions above are automated checks, not a manual assistive-technology audit. VoiceOver, physical touch/software-keyboard behavior, browser zoom and independent manual checks of every theme/width/state were not performed. No real email was sent and no production data was accessed; actual monitored-mailbox delivery, ownership, retention and the controlled operator exercise remain the rollout dependencies listed above.

Environment notes: the parent worktree was left untouched. Dependencies were copied locally from the prepared implementation worktree after a cross-worktree `node_modules` symlink failed Storybook's browser setup import. The default E2E ports were occupied by another worktree, so the successful run used the isolated ports above. Initial type errors in the save-result wiring and generated migration formatting were corrected before the passing checks.
