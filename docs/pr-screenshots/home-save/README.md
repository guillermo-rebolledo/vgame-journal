# Home Journal saving — issue #77

Captured in Chromium from the production Next.js build, using the repository's
isolated in-memory PGlite transport, fake catalog, local mailbox, and a synthetic
account. No production database or private user data is shown. Discovery artwork
and titles are deterministic fixtures, including deliberately repeated covers.

- `before-guest-desktop-dark.png`: Home before this change, 1440 × 1000.
- `guest-desktop-dark.png`: visible Backlog/Wishlist actions on search and discovery, 1440 × 1100.
- `guest-mobile-light.png`: the same actions at 390 × 844.
- `guest-auth-handoff-mobile-light.png`: explicit authentication handoff preserving the intended game and Status.
- `empty-journal-desktop-light.png`: Backlog remains available at zero.
- `saved-journal-desktop-dark.png`: matching search/personal Status labels and exact collection counts.
- `saved-journal-mobile-dark.png` and `saved-journal-mobile-light.png`: saved search state and Backlog access at 390 × 844.
- `change-status-mobile-light.png`: all four Status choices and the identifiable current Backlog choice.

The browser pass confirmed no document overflow at 320, 390, 768 and 1440 CSS
pixels, retained focus after a keyboard save and menu dismissal, and a single
Journal updates live region containing “Discovery One saved to Backlog.” The
Chromium accessibility tree reports that region as polite and atomic. Spoken
output with an actual screen reader was not tested.

The Playwright Home suite additionally covers 200% text, forced colors, measured
focus contrast, guest authentication/onboarding, account isolation, persisted
Status and Completion rules, duplicate saves, and transport-failure recovery.

Final verification after the review fixes: 304 unit tests and the full 85-scenario
Playwright suite passed in the isolated implementation worktree; the integration
checkout independently passed all 13 Home browser scenarios and the three new
component regressions. The guest-confirmation focus workflows also passed 10
repeated runs. Final screenshots were recaptured from the merged production build.
