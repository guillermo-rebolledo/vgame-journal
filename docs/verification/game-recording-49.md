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

Captured Chromium against `next build` / `next start`, at 4x desktop CPU throttling, in a single browser worker. The cold client navigation uses a server catalog cache shared with the test suite. Navigation and drawer samples are isolated from viewport changes and screenshots.

| Phase | rAF gaps sampled | Gaps >25ms | Maximum gap | Long tasks | Layout shifts |
| --- | ---: | ---: | ---: | --- | --- |
| Cold client navigation | 20 | 5 | 33.4ms | none observed | 0.0080 (recent input) |
| Drawer entrance | 33 | 1 | 66.7ms | 77ms | none observed |

Frame gaps are scheduling observations, not compositor dropped-frame counts. Long tasks and frame gaps under throttling do not establish their cause. No measured attribution to blur was obtained, so the existing blurred/drifting background was kept. The geometry test separately verifies that opening the sheet leaves the underlying page stationary and that delayed populated history leaves public scores in place.

No real mid-range phone or real iOS/Android software keyboard was available. Mobile screenshots and the simulated visual viewport are supplemental coverage, not device performance verification. There is no claim of uniformly smooth rendering.

## Review

**Standards:** Two read-only rounds found no documented-standard breaches. Correctness findings about retry duplication, concurrent membership creation and the keyboard viewport were fixed. The existing string-record form boundary was accepted as a nonblocking judgment call.

**Spec:** Focus restoration, history loading geometry and keyboard sizing were fixed. The follow-up identified ignored corrections after a lost response; the final upsert and regression test address this. No unrelated pages were redesigned.

## Migration and persistence limits

Apply `0009_playthrough_submission.sql` with the existing migration workflow before deploying the new code. It adds a nullable UUID and a unique `(user_id, submission_id)` index; existing records need no backfill. This is a small deviation from the issue's expectation of no schema change, needed for persisted retry deduplication.

Journal membership, status-event and playthrough writes remain sequential on the existing Neon HTTP driver. A failure after membership saves can leave the game in the journal; the form explicitly reports that possibility and retains the draft. Existing status/tag values are never overwritten by the recording action. No all-or-nothing claim is made. The migration was subsequently applied and verified on the database configured by `.env.local`; other deployment databases still need it before the new code rolls out.

## Swipe handle and fixed desktop panel

The editor now uses the shadcn Base UI Drawer with `showSwipeHandle`, following the linked [swipe-handle example](https://ui.shadcn.com/docs/components/base/drawer#swipe-handle). The desktop panel is centered, capped at 768px wide and 720px tall, and inset 24px from the bottom. Its 32px corners and at least 16px of space below the navbar keep the underlying page visible. On phones it remains full width with rounded top corners and the same navbar gap. The form body scrolls inside the fixed panel while the header and Save/Cancel/Delete actions remain in place. Inputs and the form scroll area do not initiate drawer swipes. Swiping preserves the draft and returns focus to the initiating action; dismissal is cancelled during persistence. No dependencies were added.

Three gesture scenarios pass: desktop mouse drag, phone touch swipe (both also exercised with reduced motion), and dismissal during a pending save. The production run passed 22 scenarios; all three gesture scenarios then passed in a focused rerun after correcting the synthetic swipe distance and waiting for the handle to settle. Add/edit/delete and profiling passed again while refreshing these screenshots. Lint, typecheck and all 159 unit tests pass.

[Desktop swipe recording](49/production-swipe-desktop.webm) · [Phone touch swipe recording](49/production-swipe-mobile.webm)

The production samples above and screenshots were refreshed for the smaller, fixed desktop drawer. Eight recording and gesture scenarios pass, including stationary panel/action-button geometry during form scrolling and the keyboard-reduced viewport. The existing real-device coverage limitation remains.
