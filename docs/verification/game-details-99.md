# Game details cleanup — spec #99

The page now uses opaque text surfaces, compact mobile identity, grouped Journal/Playthrough/list actions, a stable Playthroughs section, visible fact disclosures, and compact unavailable metadata.

## Component decisions

GameRecording and JournalStatus accept minimal composition slots so existing list controls can join the action group without moving authorization or list state. PlaythroughHistory owns both empty and populated presentation. GameFactsGrid composes the existing Fact, AgeRatingFact and LanguagesFact components, with a server-rendered regional age-rating slot. A replacement toolbar, overlay primitive, or state-management layer was unnecessary. Storybook-only action mocks prevent catalog examples from loading server persistence.

## Automated verification

- Lint and typecheck passed.
- Unit tests: 443 passed. An initial run overlapped the other builds and timed out during the first PGlite-backed discovery test; the full retry passed without changing unrelated source.
- Storybook: 80 tests across 22 files passed, and the static catalog built successfully.
- Initial full Playwright run: 164 passed, 5 failed. Four failures were stale 192px/two-image hero assertions after the intentional 80px/no-backdrop change. One new history-location test matched hidden prefetched content as well as the active page. All five were corrected; the focused final pass passed 17 cases.
- Final full Playwright run: 170 passed; one existing public-list assertion matched hidden prefetched content. Scoped it to the active main content, then reran the full public-list suite: all 7 passed. Across the complete run and targeted rerun, all 171 browser scenarios were verified. The selector correction changes only the test, not public-list behavior.

## Browser verification

Local PGlite fixtures were used; production data was not accessed.

- Both themes at 320, 390, 768, and 1440px: full-page horizontal reflow and visibility/hit-area bounds of the three action triggers passed in eight combinations.
- Viewed settled desktop and phone screenshots, the long-title missing-art fixture, and fact details reopened by keyboard after Escape.
- Existing and extended E2E cover first Playthrough creation, history ordering, pagination, Status feedback, keyboard/focus restoration, touch, pending/errors/retry, deletion, enlarged text, reduced motion, and software-keyboard-sized editor viewports.
- Permanent rendered Hades contrast checks measured at least 4.66:1 light and 7.66:1 dark for genre text. Temporarily restoring the old backdrop failed the regression at 2.20:1. The check also scans the settled page with axe and verifies large-title, action-label, icon, and hovered/focused-label contrast.
- Representative settled screenshots: [desktop light](99/desktop-light.png) and [phone dark](99/mobile-dark.png). These use deterministic local game fixtures rather than production data.

## Code review

### Standards

One finding, resolved: at 320px with 200% text enlargement, genre text in the compact identity row overflowed. Added overflow wrapping and a genre-bearing regression in both themes.

### Spec

One finding, resolved: permanent rendered Hades contrast/axe coverage was missing despite the manual measurements. Added it in both themes, with a red run against the restored backdrop.

The two review axes found no other concrete issues. Both findings and the integration-test corrections were resolved together in the final fix pass. Standards: 1 finding resolved (enlarged genre overflow); Spec: 1 finding resolved (missing contrast regression).

## Checks not performed

VoiceOver/screen-reader speech, physical-device software keyboards, and native browser zoom were not manually tested. Enlarged-text and reduced-viewport automation are distinct checks, not substitutes for those manual tests. The collaborative browser snapshot timed out twice, so the documented Playwright workflow was used for visual evidence.

## CI overlay follow-up

CI run 41873110779 exposed two pointer-action failures on the slower Linux runner: Journal-status help reopened above the removal confirmation and intercepted Retry removal, and the theme helper clicked while its nested menu was entering and repositioning.

JournalStatus now uses the existing Tooltip disabled state while removal confirmation is open. Its regression story failed before the fix and passed afterward when a late background hover arrived. The recording E2E also checks that Journal-status help stays absent across the confirmation and a second-tab round trip. The theme helper waits for its actual submenu to become fully opaque before clicking; clicks remain subject to normal Playwright hit testing. No forced clicks, arbitrary sleeps, or increased timeouts were added.

Validation: both previously failing scenarios passed four consecutive runs (8 cases total); all 32 broader accessibility/theme/recording E2E cases, 16 recording/Status unit tests, and all 81 Storybook tests passed. Lint, typecheck, and the static catalog build passed.
