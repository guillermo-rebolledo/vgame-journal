# Home discovery shelves

Captured in Chromium from the production Next.js build with the repository's isolated
PGlite database. No production database or real user account data is shown.
Discovery snapshots use a read-only IGDB Visits/metadata sample captured on
October 28, 2026; Recently released applies the approved review quality floor and two-indie reservation.

- `guest-before-desktop.png`: Home before any discovery snapshot is seeded.
- `guest-desktop.png`: guest Home at 1440px with both four-game shelves.
- `guest-mobile.png`: guest Home at 390px with two-column shelves, dark mode.
- `guest-mobile-light.png`: the same mobile layout in light mode.

- `journal-desktop-light.png` and `journal-mobile-light.png`: a synthetic test
  account with Playing and Backlog entries, confirming personal shelves and
  Library/Wishlist navigation appear before discovery.

Screenshots disable animations. Automated browser tests also cover empty Journals,
duplicate cover navigation, failure states, and dates positioned below the tiles.
