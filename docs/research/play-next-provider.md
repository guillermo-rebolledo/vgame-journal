# Play next provider feasibility and validation

Issue: [#165](https://github.com/guillermo-rebolledo/vgame-journal/issues/165).

## Validation status

On November 12, 2026, the requester confirmed that the five-person Shelf gate passed and said they would provide results. Participant-level evidence and seven-day follow-up details have not yet been supplied here. This implementation does not claim a measured retention improvement. The 28-day pilot still needs a comparison method and adequate cohort size before retention attribution is implemented.

## Controlled public-provider check — November 12, 2026

Authenticated using the existing server-side Twitch credentials, with public game IDs only. No Journal, account identities, private notes, tokens or secrets were sent in the game queries or recorded below. Automated tests use the isolated database and fake provider.

Observed HTTP 200 responses:

- Hades (113112): ten similar-game links, collection 8454, genres 12/25/31/32, three themes, perspective 3 and mode 1. No franchise was supplied. Missing relationship metadata must remain absence of evidence.
- The Witcher 3 (1942): ten similar links, collection 62 and franchise 452, with genre/theme/perspective/mode data. Its canonical platforms included Switch 2; the base release rows had no Switch 2 date, while remaster 415005 supplied one. Platform support alone cannot establish a released port.
- Grand Theft Auto V (1020): collection 847 and franchise 493, similar links and seven canonical platform names, with platform-specific release dates.
- A most-rated query with `limit 100; offset 100` returned 100 rows. Examples included South Park: The Stick of Truth (1262; 1246 total ratings), Silent Hill 2 (481; 1231), and Firewatch (9730; 1225). A four-game trending snapshot or 24-game tag shelf would omit this usable candidate range.
- The compound candidate query was checked with a union of similar IDs, collections and genres, an explicit RPG genre, and canonical/port/remaster Nintendo Switch support. Nested version release-date fields were included; the query returned 100 rows, including The Witcher 3 and Skyrim. See the implementation and adapter test for the query shape.

These samples establish query feasibility, not complete relationship coverage or recommendation quality. Fields and pagination follow the [official Games reference](https://api-docs.igdb.com/#game) and [pagination reference](https://api-docs.igdb.com/#pagination).

## Initial bounds

- Backlog: all local Backlog entries remain eligible for a Fisher–Yates shuffle. No provider request per Backlog entry and no 24-entry truncation.
- Discover seeds: at most 12, spread across the full sorted Backlog ID range, fetched in one batch.
- Strong relationships: one separate 100-game page for similar IDs/shared collections so broad popular traits cannot consume the entire retrieval budget first.
- General related pool: at most four 100-game pages from the union of relationship routes, with explicit constraints applied in the query. Popular fallback uses at most four further 100-game pages, only after a successful empty related result or an explicit request for popular games.
- A read therefore uses at most ten logical provider requests: one seed batch, one strong page, four related pages and four fallback pages. Native IGDB limiting (four starts per second), bounded 429 retries and request deadlines remain in force. A private read stops waiting after 45 seconds; individual provider calls have their existing deadlines. No unbounded crawling.
- Public seeds/pages use the existing Next `use cache` convention with the `hours` profile. No actor, Journal exclusion list or personalized response enters these caches. Account-scoped Journal exclusion, ranking, explanations and projection happen after public retrieval. No relationship-schema migration or suggested-game Journal insertion is needed.
- Canonical platforms include base, ports and remasters; recommendation release dates union those same versions. A selected platform needs its own known, nonfuture release row; card metadata lists only platforms with such a released date. Existing Catalog entries missing version release metadata remain conservatively excluded on that platform until refreshed. Unknown release dates never qualify.
- A full final page marks the result as a limited pool, never as proof that the entire Catalog has no matches. Fewer than three valid games are allowed. Provider errors surface as failures with Retry and never become an automatic popularity fallback.

The bounds keep cold reads finite while retrieving substantially beyond the old 24-candidate boundary. Their usefulness should be revisited from the working pilot, especially for sparse metadata or large Journals. Broad modes and themes can yield weak relationships, so direct similarity/series evidence ranks first and popularity only breaks relevance ties.

## UI and recording

The production Shelf composes GameCover/FallbackImage, Button, Field, Select and Drawer. Library is the closest filtering composition; Discovery is the closest cover composition. Their data and mutation responsibilities differ, so the Shelf owns its private round while reusing the primitives. Journal's existing conditional move handles Backlog starts; a focused atomic insert handles new Discover entries and never overwrites an existing entry. Neither action creates a Playthrough.

The existing untracked prototype, specification and unrelated local files were left untouched. Production imports do not depend on the prototype or Storybook.

## Verification limits

Automated interaction checks cover keyboard dismissal/focus restoration, both themes, widths 320/390/768/1440, missing art, long titles, filters, rounds, explicit recording and failure recovery. Real VoiceOver, physical touch/software keyboards, actual browser 200% zoom and OS text enlargement require human verification. These are not implied by Axe or viewport checks.

Only bounded source/action telemetry is added (two enum properties). No identity-based retention join, inferred taste profile or new analytics platform is introduced.

## Automated evidence

- `pnpm lint`, `pnpm typecheck`: passed.
- `pnpm test --maxWorkers=2`: 687 tests passed. The default-worker run competed with simultaneous builds and exceeded local test/resource limits; no test-timeout configuration was changed.
- `pnpm test:storybook`: 286 local checks passed, including existing untracked prototype stories; CI only includes committed stories.
- `pnpm build-storybook`: passed, with catalog output remaining outside production.
- Full Chromium run: 233/235 passed initially. The list-recovery timeout passed on rerun. The Home scroll-position regression was reproduced with the Play next link removed as well; inline search focus now uses `preventScroll`. The existing Home-context regression test passed afterward.
- Final focused Playwright run: 21/21 passed across Play next, shared accessibility and Home-context suites. The list-owner suite also passed all ten journeys in its focused rerun.
- Reviewed captured light desktop and dark phone layouts, including missing art and available actions. Automated reflow/Axe checks cover both themes at 320/390/768/1440px. VoiceOver, real touch/software keyboard, real browser zoom/text enlargement and a human retention pilot remain unperformed.

No temporary diagnostic harness or debug instrumentation is retained.
