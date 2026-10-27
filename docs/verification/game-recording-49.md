# Game recording verification — #49

The game page now has one coordinated personal-content boundary, two 44px circular recording actions, a Base UI shadcn journal dropdown, and a shared bottom sheet for Add/Edit. Populated history follows public game details so delayed history cannot push the scores, summary, platforms or release dates. The cover morph, route motion and drifting background are preserved.

## Behavioral verification

- `pnpm lint` and `pnpm typecheck` pass.
- Full Vitest suite: 18 files, 159 tests pass. Tests use PGlite with migrations, never Neon.
- Thirty relevant production Playwright scenarios are covered. The broad run passed 29; after correcting the remaining entrance-timing assertion, all five recording scenarios passed in the focused rerun.
- Production Playwright coverage includes journal statuses/tags/removal and retry, explicit Add/Edit/Delete, invalid and failed submissions retaining drafts, disclosed status for a game outside the journal, private notes/export, pagination with 100 playthroughs, signed-out actions, missing platforms, delayed populated history, both themes and phone/desktop sizes, keyboard popup dismissal/focus restoration, reduced motion and unsupported View Transitions.
- A simulated reduced visual viewport checks that the sheet footer remains above a software keyboard. Cancel does not create membership or playthroughs and discards its draft; Close retains it.
- TDD reproduced invalid input creating no membership, duplicate inserts on retry, and corrections being ignored after an ambiguous response. The final submission method validates first, preserves existing membership, deduplicates by submission ID, and persists corrections to the same playthrough on retry.

## Production motion evidence

[Recording](49/production-navigation-drawer.webm) · [Raw samples](49/production-profile.json)

Captured Chromium against `next build` / `next start`, at 4x desktop CPU throttling, while three browser workers ran. The cold client navigation uses a server catalog cache shared with the test suite. Navigation and drawer samples are isolated from viewport changes and screenshots.

| Phase | rAF gaps sampled | Gaps >25ms | Maximum gap | Long tasks | Layout shifts |
| --- | ---: | ---: | ---: | --- | --- |
| Cold client navigation | 49 | 6 | 33.4ms | none observed | 0.0080, recent input |
| Drawer entrance | 16 | 1 | 83.3ms | 84ms | none observed |

Frame gaps are scheduling observations, not compositor dropped-frame counts. The drawer has a measured main-thread long task under throttling; this evidence does not establish its cause. No measured attribution to blur was obtained, so the existing blurred/drifting background was kept. The geometry test separately verifies that opening the sheet leaves the underlying page stationary and that delayed populated history leaves public scores in place.

No real mid-range phone or real iOS/Android software keyboard was available. Mobile screenshots and the simulated visual viewport are supplemental coverage, not device performance verification. There is no claim of uniformly smooth rendering.

## Review

**Standards:** Two read-only rounds found no documented-standard breaches. Correctness findings about retry duplication, concurrent membership creation and the keyboard viewport were fixed. The existing string-record form boundary was accepted as a nonblocking judgment call.

**Spec:** Focus restoration, history loading geometry and keyboard sizing were fixed. The follow-up identified ignored corrections after a lost response; the final upsert and regression test address this. No unrelated pages were redesigned.

## Migration and persistence limits

Apply `0009_playthrough_submission.sql` with the existing migration workflow before deploying the new code. It adds a nullable UUID and a unique `(user_id, submission_id)` index; existing records need no backfill. This is a small deviation from the issue's expectation of no schema change, needed for persisted retry deduplication.

Journal membership, status-event and playthrough writes remain sequential on the existing Neon HTTP driver. A failure after membership saves can leave the game in the journal; the form explicitly reports that possibility and retains the draft. Existing status/tag values are never overwritten by the recording action. No all-or-nothing claim is made. Production migrations were not applied as part of this PR.
