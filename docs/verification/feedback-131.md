# Issue #131 verification

The implementation reuses Feedback and its existing Base UI Drawer, Select, Field, Button, ActionIcon and ActionFeedback. `FeedbackChannel` composes those production components to share a single editor across originating controls and to show an inline first-save invitation. The closest existing component was Feedback itself; a second reporting form would duplicate its validation, recovery and focus behavior. `SupportLink` extracts the existing native-link pattern for the distinct pre-account email contact purpose. No new primitive, dependency or motion was added.

## Automated evidence

- Red → green: feedback-module test observed an unredacted reset credential before the shared pathname normalizer; it now checks storage and notification for auth credentials, calendar secrets, profiles and Lists. First-save claim test initially observed no opportunity; the migration trigger now creates one, with only one successful concurrent claim and no opportunity after deleting/re-adding. Migration test verifies existing empty/populated accounts are consumed and old explicit column-list writes still work.
- Browser journeys cover empty Home Journal and Library entries, permanent account-menu feedback, focus return, category guidance/draft preservation, privacy explanation, server rejection, offline retry, rolling throttling, persisted reports, mock notifications, and guest action rejection.
- First-save journeys cover successful game Status and Playthrough saves, canceled and failed saves, concurrent first saves in separate sessions, dismissal, reload, another session, and deletion/re-adding. The opportunity is consumed in the first Journal insertion’s transaction and returned only by that save request. Later saves cannot recover an abandoned opportunity, including after an old deployment inserts the first game.
- Public support journeys inspect signed-out sign-in/signup/recovery/reset/onboarding pages and an authenticated pre-username player. Every link uses the single configured address and neutral subject with no token, complete URL or personal context.
- Feedback scans pass WCAG A/AA rules in light and dark at 320, 390, 768 and 1440px with reduced motion and a 2,000-character draft. All widths have no horizontal page overflow. Existing shared accessibility journeys cover both themes, page landmarks, Journal actions and Playthrough recording.
- Storybook covers the production editor's success, pending, validation, network recovery, category guidance, long draft, keyboard entry and originating-control focus restoration; AccountMenu retains its existing keyboard journey.

Final checks:

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed |
| `pnpm test --maxWorkers=2` | 41 files, 524 tests passed |
| `pnpm test:storybook --maxWorkers=1` | 41 files, 193 tests passed |
| `pnpm build-storybook` | Passed; output remains local/CI-only |
| Feedback, Home-save and action-feedback Playwright journeys | 17 passed |
| `e2e/accessibility.spec.ts` | 10 passed in the combined verification run |
| Home personal journeys | 2 passed in the earlier affected-flow run |
| Production Next build | Passed as part of Playwright startup |

Playwright used isolated ports 3310/3311 because the defaults were occupied by another checkout. Initial red tests and selector/transition failures were fixed and the affected suites rerun. A pre-existing Base UI focus-guard scan failure appeared once in the unchanged Drawer viewport story; the final complete serial Storybook run passes without exclusions. Builds retain existing dependency/docgen/bundle warnings, and unit execution emitted existing timeout-overflow/jsdom navigation warnings without test failures. Test mail goes only to the isolated mock mailbox, and database tests use PGlite. No production data or real email delivery was used.

## Visual and manual review

Visually inspected the generated [light 320px](feedback-131/light-320.png), [dark 390px](feedback-131/dark-390.png) and [light 1440px](feedback-131/light-1440.png) screenshots: category guidance, labeled message, count, privacy text and actions fit the drawer and remain readable. Keyboard Enter/Escape, modal focus and focus restoration are exercised by browser/Storybook automation; they were not separately verified by a human keyboard session. Existing viewport-aware Drawer scrolling is reused.

Unavailable manual checks: a physical mobile software keyboard and touch interaction, VoiceOver or another screen reader's actual announcements, human focus-visibility review at every width, and feedback-specific 200% browser zoom/text enlargement. Automated role/status assertions and axe checks do not substitute for those checks. Home's existing 200% text/reflow journey passes, but does not establish that manual feedback check.

## Operational acceptance

Still unverified: a named feedback owner/backup, actual notification delivery to the monitored inbox, confirmation that the public support mailbox is monitored, mailbox readers, retention/deletion practices and the synthetic reconciliation/acknowledgement/shipped-reply rehearsal. See [the operator runbook](../feedback-operations.md). The public support address was supplied by the user; no owner, retention period or delivery success is invented. Issue #130 owns the authoritative privacy notice.

Review fixes additionally passed 82 targeted module tests, the SupportLink focus story, the full Storybook suite/build, lint/typecheck, and 25 combined feedback/accessibility/Home-save browser tests. Reconciliation uses mandatory bounded full rescans against private processed-ID records so late commits cannot fall behind a persistent cursor.
