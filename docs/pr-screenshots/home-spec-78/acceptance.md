# Home spec #78 acceptance evidence

Baseline: `d4f0a08`. Issue #78 is one spec with no child tickets. Related #77 merged into main through PR #80 during implementation. This branch
integrates it and reuses its single save coordinator, canonical game IDs, owner
checks, explicit guest confirmation, shared Status labels, and solid focus tokens.

| Finding | Observable behavior | Focused evidence |
| --- | --- | --- |
| 5 | Task-led introduction defines Journal, Library, Status, and released/upcoming Wishlist use | `home-guest.test.tsx`, guest browser review |
| 6 | Signup precedes compact, explicitly illustrative Backlog/Wishlist rows | `home-guest.test.tsx`, `home-context.spec.ts`, guest screenshots |
| 7 | Saving and guest authentication guidance sits beside search | `home-guest.test.tsx`, associated input description |
| 8 | General Home auth actions retain query, filters, expansion, and disclosure through account flows without writes | `home-auth-actions.test.tsx`, `home-context.spec.ts`, existing continuation tests |
| 9 | Confirmed current Status remains visible with one game-specific success outcome; Playthrough guidance is separate | `journal-status.test.tsx`, `game-recording.test.tsx`, `game-recording.spec.ts` |
| 10 | Summaries precede capped personal shelves; one/two entries use rows; View all opens the appropriate Library view | `home-journal.test.tsx`, `home-personal.spec.ts`, returning screenshots |
| 11 | Compact region-resolved Wishlist preview uses existing date precision/order/local-day rules | `home-wishlist-preview.test.tsx`, Journal/release-date tests, `home-personal.spec.ts` |
| 12 | Recently added includes Playing and preserves addition time across Status changes | `home-journal.test.tsx`, Journal integration tests, `home-personal.spec.ts` |
| 13 | All saved games aggregate and Backlog/Wishlist subsets have truthful counts and hierarchy | `home-journal.test.tsx`, `home-personal.spec.ts` |
| 14 | Full bounded candidate set survives caching; filters precede six-result display limit | Catalog integration tests, search component tests |
| 15 | Useful dimensions, unavailable values, mobile disclosure, active count, and Clear filters remain recoverable in the URL | Search component tests, `home-context.spec.ts`, search workflow tests |
| 16 | Search/discovery share release-year and platform presentation; missing metadata is honest, additional platforms are operable | Search/Catalog tests, discovery browser review |
| 17 | System follows live OS preference; explicit appearance persists; fresh visitors retain Dark default | `theme-provider.test.tsx`, `home.spec.ts` rendered-color checks |
| 18 | Discovery has loading/empty/error/retry states, retains mounted stale success, and refreshes snapshots read-only | `discovery-content.test.tsx`, discovery module tests, `discovery.spec.ts` |
| 19 | Persistent visible Search games label, named search landmark, and associated guidance | Search component tests, browser label/landmark checks |
| 20 | First-focusable skip link moves focus/viewport to main; header visual and keyboard orders agree | `skip-link.test.tsx`, `navigation.spec.ts` |

## Verification

Baseline: `pnpm test` passed 28 files / 301 tests. New app-level checks failed
against the baseline for the missing search landmark and missing Home returnTo.
Final checks:

- `pnpm lint`: pass (195 files).
- `pnpm typecheck`: pass (Next route generation and TypeScript).
- `pnpm test`: 35 files / 366 tests passed.
- `pnpm test:e2e --workers=4`: all **103** combined production browser cases passed after integrating #77 (3.7 minutes).
- Focused combined save/discovery/auth/keyboard/focus verification: 13 cases passed.
- `git diff --check`: pass.

Screenshots were inspected at phone and desktop sizes in both themes. The browser
workflows check 320px, 390px, tablet/desktop, 200% text, reduced motion, and both
forced-color appearances. All temporary implementation worktrees were removed;
branch references remain available. The PR embeds focused screenshots and links
the complete [evidence inventory](README.md).

All module tests use isolated PGlite/fake sources. Browser workflows use the
production Next.js build, isolated PGlite transport, fake GameSource, and local
mailbox. No tests use Neon or live IGDB API data. Cover artwork is decorative.

## Review limits

No real screen-reader speech or physical-device check was run. Browser semantics,
keyboard tests, and screenshots do not establish spoken usability or blanket WCAG
conformance. Discovery stale retention applies while mounted during refresh;
a full reload does not retain prior in-memory content. The snapshot read exposes
one area-level read boundary, so read errors use one area-level recovery state.

## Standards review

No hard documented-standard violations. Two low-priority judgment calls were
resolved: unused GameSearch guest-content slots were removed, and Home/Wishlist
release-phase classification now shares `releasePhase`. Lint and typecheck pass. A fresh standards review of the combined #77/#78 diff found no violations or actionable smell findings.

## Spec review

One partial requirement was found and resolved: both header sign-in entries now
retain validated Home browsing context. Component and production browser coverage
exercise both header entry points as well as the body signup/sign-in flow.
After #77 merged, a fresh review found one additional product issue and two test
mismatches. Platform disclosures now share the solid 3:1-or-better focus treatment;
normal-theme and forced-colors browser checks cover them. Skip readiness and focus
assertions now exercise the accepted game-specific names and stronger system-color
outlines. No unresolved product finding or material scope creep remains.

## Runtime corrections

The first full browser run exposed nine failures. Stale labels and hidden-select
queries were reconciled with the intended UI. Header/skip tests now wait for the
request-scoped surfaces they traverse. Delayed detail content received a matching
loading reserve to remove the observed 49px shift; both empty and saved-history
cases retain the original stability assertion. Drawer tests suppress Playwright's
pre-click action scroll and still require unchanged position after opening.
Forced-colors controls now receive a visible system-color focus outline.

Retained Home views also receive unique per-instance search input, label, filter,
result, and disclosure IDs. A component regression fails against the old static
IDs and passes with the change; the discovery retry browser case requires exact
accessible names after returning to a query-bearing Home view. Recovery checks
scope themselves to accessible status regions so hidden retained copies cannot
satisfy or ambiguously fail the outcome assertion.

## Shared Home save integration

All Home occurrences, including discovery, search, Playing, Recently added, and the
selected Wishlist preview, use the accepted #77 save controls. A single confirmed
projection supplies counts, current Status, original added timestamps, and only the
region-resolved release needed by the preview. Per-game reconciliation preserves
newer responses for other games and sorts by original addition time/title.

The combined browser acceptance changes an older entry through search, verifies
that its original Recently added position remains, checks region-specific preview
and subset counts, then changes it through a personal shelf and verifies every
occurrence, reload, original timestamp, and private history. Pending guest intents
still require explicit confirmation. Existing owner checks and no-write ordinary
authentication return coverage remain in place.

Discovery fixture cleanup restores the prior snapshots directly through the
acknowledged isolated SQL seam; it does not depend on bypassing the production
refresh lease. Production Retry remains a read-only snapshot refresh.
