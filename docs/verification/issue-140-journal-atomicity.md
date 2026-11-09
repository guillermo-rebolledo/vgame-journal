# Journal atomicity — issue #140

## Boundary and adapter

Every affected mutation acquires `SELECT ... FROM "user" WHERE id = $owner FOR UPDATE` as the **first statement** in one transaction. The production Neon client explicitly requests READ COMMITTED. Mutable membership/history/confirmation decisions run in subsequent statements at READ COMMITTED, after any previous owner transaction commits. Putting the lock inside the decision statement would retain its pre-wait snapshot and is deliberately avoided. This durable row also covers games with no entry yet.

The tradeoff is serialization of all Journal writes for one player, including Ratings and Playthrough-only mutations. Different players never share an application lock. Each operation takes one explicit owner lock before touching entries and dependent rows, with no second owner lock or reverse acquisition path. Account deletion already deletes that same owner row first. Database failures/deadlocks propagate to existing safe action errors; there is no blind internal retry. The editor retains its submission identity and draft for a deliberate retry.

`executeBatch` keeps the existing Drizzle Neon HTTP transport and returns the last statement's rows. Installed Drizzle 0.45.4 `NeonHttpSession.batch` calls the installed Neon 1.2.0 client's `transaction()` once; interactive Neon HTTP transactions remain unsupported. The narrow adapter test replaces only HTTP fetch and verifies a single batch envelope from the actual app database client, the ReadCommitted isolation header, final-result mapping, and error propagation. PGlite uses an interactive READ COMMITTED transaction. E2E's existing batch adapter sends the complete statement array to one PGlite transaction. Lists/Feedback retain their two-statement interface and results.

## Caller inventory and contracts

- `src/app/home-actions.ts`: Home discovery/search and personal shelf Status controls, also reached through the Catalog drawer on Library/Wishlist. Always delegates the decision to `set`; `preserveCompletionTag: true` preserves an unchanged Played tag under the lock. No caller-side stale read skips the mutation.
- `src/components/playthroughs.tsx`: game detail Status/tag, removal, Rating, recording and Playthrough edit/delete server actions, including detail rendered in the shared Catalog drawer. Existing `GameRecording`, `JournalStatus` and `PlaythroughForm` are reused; no new primitive was needed. The closest existing recovery pattern is `PlaythroughForm`'s retained draft and submission ID. The server action refreshes after rejected writes and confirmation conflicts, removing obsolete partial-success copy without claiming rollback on a lost response.
- `src/app/wishlist/page.tsx`: conditional move and Undo; existing `Date | null` contract retained.
- `addPlaythrough` has no production caller; tests/importers retain its existing membership-required contract. `recordPlaythrough` remains the production recording boundary.
- Export, stats, public profiles, Rating aggregation, account deletion, Lists and Feedback retain their read/visibility/domain contracts. History continues ordering by `(at, id)`.

Existing returns remain: `set`/`recordPlaythrough` return the one-time first-save feedback invitation boolean; `move` returns its version Date or null; `remove` returns undefined or `{confirmationRequired, rated, playthroughCount}`; other writes return void or throw. Optional safeguards are additive: `remove(..., expectedSnapshot)` rechecks exactly what the caller saw; `recordPlaythrough(..., requireMembership)` prevents a previously saved-game editor recreating deleted membership; `updatePlaythrough(..., expectedGameId)` reports disappearance instead of misleading editor success. All production callers supply these safeguards. Legacy module callers omitting them retain their old immediate-confirmation/no-op semantics.

The editor retains `membershipRequired` in its draft, so a refresh after a conflict cannot turn the same existing-game draft into permission to create membership. This is a precondition, not an authorization credential; ownership always comes from the checked session.

## Operation matrix

All rows below use the owner lock and one atomic batch. Validation of dates, hours, platforms, Status/tag and UUIDs remains at the public boundary.

| Public operation | Transaction scope / mutable precondition | No-op and retry | Failure / evidence |
| --- | --- | --- | --- |
| `set` | Conditional entry upsert + matching history + first-save invitation consumption; preserves Rating and addition order | Same Status/tag writes no event/version; unconditional different set is serialized last writer wins | Constraint-rejected history restores full export; identical/different concurrent sets and same-clock versions covered |
| `move` / Undo | Conditional entry update + history; Status and optional `updatedAt` checked under lock | Failed condition or unchanged selection returns null, no event; accepted version advances even with equal clocks | Rejected history restores prior version; one racing move wins; stale Undo leaves later changes intact |
| `recordPlaythrough` | Membership-if-needed + initial history + submission upsert + invitation; account submission/game match rechecked inside batch; optional membership precondition | Same game/submission updates the existing record, preserves existing Status/tag/Rating/addition order; different game rejected with no writes | Later Playthrough constraint rolls back membership/history/invitation; retry succeeds once; concurrent identity/record-vs-set/remove tests |
| `remove` | Snapshot/Rating/Playthrough confirmation check + entry delete (cascades Playthrough/Rating) + removal history | Absent entry returns undefined with no event; stale snapshot returns current confirmation contents, no writes | Rejected history restores entry, Rating and private notes; new Rating and edited note invalidate old confirmation; remove-vs-record/edit/add/delete/rating covered |
| `addPlaythrough` | Membership-required insert under owner lock | Missing membership rejects; no membership recreation | Isolated failure/ownership tests and remove race; one insert cannot partially commit |
| `updatePlaythrough` | Validated, account-scoped update under owner lock; browser supplies expected game | Legacy unowned/missing ID remains a no-op; browser disappearance throws safe draft-retaining conflict | Constraint failure restores export; retry updates same ID; removal cannot leave an orphan |
| `removePlaythrough` | Account-scoped deletion under owner lock | Missing/unowned row is a no-op | Existing ownership tests and removal race; one delete cannot partially commit |
| `setRating` / `clearRating` | Existing conditional Rating update under same owner lock; Status eligibility unchanged | Same Rating preserves rated-at; never changes Status timestamp/history | Existing Rating/Community/isolation tests; stale removal snapshot rechecks Rating and rated-at |

An unchanged Status retry after a committed but unacknowledged request is a no-op **while that state is still current**. Selecting it after an intervening accepted change is a new intentional transition. Status saves have no durable request identity and do not promise indefinite exactly-once delivery. Playthrough retries retain their existing account-scoped submission UUID contract. No historical repair is performed: past missing events remain missing, and existing timestamps/events are never rewritten.

## Evidence and limits

Module tests run exclusively against `createTestDb()` with every migration applied. Failures are injected using temporary constraints in that isolated database, never production flags. Complete exports establish rollback, including timestamps, Rating and private data. PGlite queues transactions; concurrent public calls and explicit stale snapshots establish deterministic module outcomes but **do not prove independent Postgres session locking**.

Browser coverage: `journal-atomicity.spec.ts` adds committed-but-lost recording response/retry, same-account independent-context edited-note removal conflict, and stale existing-game draft recovery. Existing Home first-save, game recording/error/draft/removal, Wishlist move/Undo, and accessibility journeys remain regression gates. `PlaythroughForm/RemovedInAnotherTabKeepsDraft` covers the new conflict message with a retained draft.

Independent production-driver check: **PENDING — no explicitly isolated nonproduction Postgres/Neon target was supplied or accessed.** No ordinary unit/E2E test accesses Neon. Provider-level concurrency is not claimed by this change.

## Independent-connection verification (operator, isolated target only)

1. Provision an explicitly disposable nonproduction Postgres database/Neon branch with synthetic data only. Apply all repository migrations. Keep its HTTP connection string in a private environment variable and its direct connection string in another; do not log either or reuse production `.env.local`. Use installed versions from the lockfile. This procedure is separate from `pnpm test` and `pnpm test:e2e`.
2. Seed synthetic accounts A/B and two Catalog games supporting the chosen platform. Record the branch/database identity without credentials. Open two **direct** `psql` connections and record `SELECT pg_backend_pid()` to establish distinct sessions. In session 1: `BEGIN; SELECT id FROM "user" WHERE id = '<A>' FOR UPDATE;`.
3. From another process using `createJournal(drizzle(neon(isolatedHttpUrl, {isolationLevel: "ReadCommitted"}), {schema}))`, start a Status save for A on an initially absent game. It must remain pending behind session 1's lock. In session 1 insert that game's synthetic entry and corresponding history, then COMMIT. The HTTP operation must see the committed state after acquiring the lock: an identical set produces no extra event; a different set produces one ordered transition. Repeat with membership existing. Never combine lock acquisition and decision in one statement.
4. While A is held, run a Journal write for B through another HTTP client; it must complete independently. Use the direct session's `pg_stat_activity`/`pg_locks` to observe A waiting without exposing SQL parameters or connection secrets.
5. Through two independently constructed HTTP clients, run identical sets, different sets, two moves with the same version, record/record with the same UUID, cross-game UUID reuse, record/set, and remove/record/edit with the original removal snapshot. Exercise **both lock acquisition orders** by holding/releasing A's lock in the direct connection; verify current entry, ordered history, Playthroughs, Rating and export after each pair. Assert one effective identical transition, exactly one move winner, coherent final history, stale confirmation preserving new notes/Rating, and no orphans. Do not prescribe a winner for unconditional sets.
6. Add a temporary CHECK constraint rejecting the *later* history/Playthrough write, call each public multi-write operation through the real HTTP adapter, and compare complete before/after exports. Remove the constraint and retry with the same UUID/version; verify a single successful change and correct first-save invitation. Confirm an HTTP error did not partially commit. For a lost response, read server state before interpreting the outcome or retrying.
7. Record date, disposable target identity, package versions, distinct backend PIDs, observed lock wait, B's independent completion, both-order race outcomes and rollback/retry results here. Delete synthetic accounts (cascade their private data), synthetic games and temporary constraints, close sessions, and destroy the disposable branch. Never manufacture or repair historical production events.

## Checks

- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test --maxWorkers=2`: 42 files / 545 tests passed, including Journal, Lists and Feedback. The adapter contract's final app-client/isolation-header extension also passed separately (2 tests). Date-based timer overflow warnings from existing tests did not fail the run.
- `pnpm test:storybook --maxWorkers=1`: 41 files / 194 tests passed. An earlier two-worker run transiently flagged Base UI focus guards in the unchanged Drawer viewport story; its focused rerun and the complete rerun passed.
- `pnpm build-storybook`: passed.
- `E2E_PORT=3520 E2E_SUPPORT_PORT=3521 pnpm test:e2e e2e/journal-atomicity.spec.ts e2e/home-save.spec.ts e2e/game-recording.spec.ts e2e/workflows.spec.ts e2e/accessibility.spec.ts --workers=2`: 42 journeys passed against the final implementation (including both themes' accessibility and enlarged-text touch editor checks). The first run exposed the obsolete stale-removal expectation and one touch-scroll timing failure; the updated complete rerun passed.
- `git diff --check`: passed. No schema migration, new dependency, production repair or live Neon access was needed.

Manual keyboard/reflow/error-state behavior is exercised by existing browser and Storybook interactions. A human VoiceOver pass, physical mobile software-keyboard/touch checks, full 200% zoom matrix and visual inspection at every DESIGN.md width remain pending; automated accessibility scans do not substitute for them.
