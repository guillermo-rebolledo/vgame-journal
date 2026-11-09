# Issue 151: Steam import verification and release gates

Steam import stays disabled unless `STEAM_IMPORT_ENABLED=true`, `STEAM_WEB_API_KEY` and `STEAM_STORAGE_COUNTRY` are all set. The owner must complete the live checks below before enabling it. A country string is a deployment assertion, not an automatic location detector.

## Implemented behavior

Settings connects an existing signed-in account through Steam OpenID 2.0, reads Steam games on request, matches exact appids, and reviews new games before one atomic Backlog insertion. Existing entries and any game with Status history are excluded under the account lock. Editions normalize to a base game; ambiguous IDs remain unmatched; non-games are excluded. No Playthroughs or Steam playtime records are created. Disconnect removes only the Steam connection.

The additive migration adds `steam_link` (including a `review_ready` flag to distinguish an immediately committable review from active execution/cooldown) and nullable `journal_entry.import_source`. Export includes the connection and source marker; account deletion cascades the link. OpenID state uses the existing verification table, expires in ten minutes, is session/account-bound, and is consumed once. The callback verifies signed fields and asks Steam to authenticate the entire assertion at the fixed endpoint.

The import cap is 10,000 appids. A read claims 60 seconds; commit claims a three-minute execution window and extends the cooldown to five minutes on success. Failed commits retain a one-minute retry window. Conditional lease finalization cannot overwrite a newer operation. Catalog work precedes the locked Journal batch. A failed or uncertain database response can be retried safely: existing entries are skipped.

## Local evidence

- `pnpm test --maxWorkers=2`: 658 tests passed after review fixes. The initial run alongside other heavy checks had five existing PGlite-test timeouts; the two-worker run passes.
- `pnpm test:storybook`: 233 checks passed, including focus/selection recovery stories.
- `pnpm build-storybook`, `pnpm typecheck`, `pnpm lint` passed.
- `pnpm test:e2e e2e/steam-import.spec.ts e2e/accessibility.spec.ts e2e/large-collections.spec.ts --workers=2`: 17 passed; both Steam flow/accessibility tests passed again after review fixes.
- Unit tests exercise hidden/empty/over-limit responses, exact mapping and normalization, ambiguous IDs, all review classifications, concurrent cooldown claims, commit input validation and re-mapping, upstream failures, preservation of existing Journal details, removed games, idempotency, first-save consumption, disconnect and account deletion/export.
- A 10,000-entry PGlite import test checks inserted/history counts, no Playthroughs, idempotent retry, and Library consistency. It does not establish Neon performance.
- Adapter tests verify quoted uid batches of 500, cursor traversal across duplicate external IDs, and bounded short-429 retries. OpenID tests cover each rejection path and state replay, with no live provider requests.
- Playwright exercises a fake Steam redirect and verification server through the real verifier, hidden-then-fixed retry, selection, commit, Backlog in Library, re-import and disconnect. Fake endpoints and game mappings are confined to the existing isolated E2E aliases.
- Playwright covers 2,000 and 10,000-entry Library, Home and signed-out public profiles. All collection grids mount 48 rows per page. Timing attachments are diagnostic, not production latency guarantees. These checks did not justify replacing the current collection pagination/data model in this change.
- Component stories cover connection states, failures, pending progress, hidden/empty/over-limit responses, unmatched and removed games, Public/Private guidance, keyboard selection, commit recovery, and 10,000-row paging. The accessibility spec covers review at 320px.

Component choice: SteamImport composes existing Button, Select, PagedList, ActionFeedback, toast and first-save feedback. CalendarFeedForm is the closest Settings composition, but does not own multi-game review. Checkbox is the shadcn Base UI registry primitive, with colocated states and keyboard interaction stories. No new animation system or dependency was added.

## Owner release checklist (not completed locally)

1. Register a Steam Web API key for the production domain and set it only in the server environment.
2. Confirm GetOwnedGames responses for public, friends-only and private Game details using real accounts. Missing `game_count` must mean unreadable, not empty.
3. Complete one genuine Steam sign-in and verify the connected account, cancelled sign-in and disconnect.
4. Verify every location where stored Steam identifiers are processed/persisted (including database and hosting regions), set the verified country description in `STEAM_STORAGE_COUNTRY`, and review the rendered `/privacy` notice. Do not guess a country to enable the feature.
5. Review the visible “as is”, warranty/liability and non-endorsement notices against Valve's terms before release.
6. Measure the locked 10,000-row batch on an isolated Neon branch with production-like data. Do not run performance tests against a player's Journal. Lower the cap if it exceeds the database request timeout or acceptable latency.
7. Review production Library/Home/public-profile timing and payloads at the import ceiling; local PGlite/browser checks do not establish serverless memory/network performance.
8. Finish manual DESIGN.md QA: VoiceOver/screen-reader navigation and announcements; both themes at 320/390/768/1440px; 200% zoom and enlarged text; reduced motion; real touch input. Automated keyboard and accessibility checks do not replace these.
9. Only after these gates pass, set `STEAM_IMPORT_ENABLED=true`.

No live Steam login, real-key request, Neon write/benchmark, or physical-device/screen-reader check was performed during implementation. No API key or storage-country assertion was invented.

## Standards review

Two findings, both resolved: focus after completion/disconnect now returns to a surviving action, and failed rereads retain the existing review and choices. Stories assert both behaviors. No material baseline code-smell findings. Manual device and screen-reader checks remain pending.

## Spec review

One finding, resolved: one timestamp alone could not distinguish an immediately committable review from a commit cooldown. A single `review_ready` boolean on the existing connection row resolves that ambiguity without adding an import-run table. Regression tests cover the entire five-minute cooldown, overlapping slow commits, and stale finalization. No scope creep found.

Review totals: Standards 2 resolved (focus/selection recovery); Spec 1 resolved (cooldown/lease distinction).
