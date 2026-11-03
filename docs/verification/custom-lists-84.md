# Custom Lists acceptance — #84 / #88

## Final implementer fix pass and upstream integration

November 3, 2026. Isolated worktree
`/Users/guillermoortizrebolledo/.t3/worktrees/vgame-journal/t3-c1705a85`, branch
`t3/custom-lists-integration`. The supplied worktree started clean at
`c11609ff6fb9ff915ece9f01f10fa415ffd92922`, exactly matching integration branch
`t3/public-private-custom-lists`; ancestry was confirmed before edits.
Merged `origin/main` at `c551ecc92e9235c366690d63593e4e52d3b55b99` (including
`b0db8e9ba4db826bcfa2909aed849cd41dd9d86a`, age ratings/languages #82, and
production build migrations #89). No additional agents were spawned.

### Review responses

First reviews at the starting SHA reported **0 hard Standards violations,
3 nonblocking advisories, and 0 Spec findings**. All three advisories are addressed:

1. **Narrow public preflight:** Proxy now calls `lists.hasPublicList`, selecting
   only a list ID with a limit of one. It shares the current Public/creator
   predicate with the full public projections and performs no game aggregation
   or count. Page, metadata and image authorization remain independent. The
   existing browser checks retain real early 404s for inaccessible URLs and
   verify revocation between preflight and rendering. At the confirmed
   `createLists`/migrated-PGlite seam, the new access-policy test failed first
   because the method did not exist, then passed through private/public changes,
   case-insensitive creator matching, invalid/missing IDs, membership and deletion.
   The existing unavailable-read test now includes the narrow query.
2. **Private validation reuse:** create/edit share the title/description checks;
   add/remove/reorder share Catalog-ID validation. No validator is exported.
   Validation order, bounds, defaults, trimming, retained description line breaks,
   operation-specific outcomes and messages are preserved. Existing service
   boundary validation and browser recovery checks cover the refactor.
3. **Private mutation readback:** metadata edits and non-delete changes share
   `readMutationResult`, including the same not-found/unavailable mapping.
   Every exported action still obtains a fresh session and checks the expected
   actor explicitly before any service read or mutation. Existing direct action
   forgery, expired/switched-session, stale-write and lost-response browser
   journeys exercise those public action boundaries.

The earlier stale Move down fix remains intact. No new product behavior or
unrelated refactor was added, and no functional objection remains from the first reviews.
The integration tip was rechecked before commit and remained `c11609ff6fb9ff915ece9f01f10fa415ffd92922`, already included in this branch.
The parent will review the changed area again before marking draft PR #90 ready.

### Conflict and migration resolution

Read the actual upstream commit messages, PRs #82/#89 and age/language spec #81.
Resolved all three conflicts: game-page imports retain the full upstream facts,
Region-sensitive age-rating boundary and JSON-LD alongside the Add-to-list island;
the journal and `0013` snapshot retain upstream's history. The schema auto-merge
is additive and retains both age/language columns and list tables.

Upstream `0013_illegal_pet_avengers.sql` and `0013_snapshot.json` are unchanged.
Removed superseded, unmerged `0013_fresh_scrambler.sql` and regenerated the list
migration from the merged schema as `0014_high_lilandra.sql`; its SQL matches the
previous feature migration. The journal's new timestamp is **1793742538059**,
strictly later than upstream `0013`'s **1793735350587**. Snapshot `0014`
`e622a7c4-2138-4056-abde-12a994d8e3c5` points to upstream `0013`
`a92233ad-19fd-4650-a339-f346f06c4578`. All journal timestamps are monotonic.
Generated metadata was formatted to satisfy Biome; the final `pnpm db:generate`
reports **No schema changes, nothing to migrate**.

An additional local PGlite upgrade check first applied upstream's migrations
through `0013`, inserted an age/language Catalog sentinel, then applied the merged
chain. All **15 migrations** were recorded, both list tables were created, and
the existing Catalog row was unchanged. Full module/browser runs also apply the
real complete migration chain to fresh isolated PGlite databases.

Upstream's production-only build migration hook and AGENTS guidance are unchanged.
The added migration creates list tables/indexes/constraints and preserves existing
data and columns for the prior deployed application.

### Final verification

All browser runs use production `next build` + `next start`, Chromium, two workers,
`E2E_PORT=3600 E2E_SUPPORT_PORT=3601`, and this worktree's own `.next-e2e`.
The existing harness blanks `DATABASE_URL` and external provider credentials;
it invokes `next build` directly rather than the production deployment hook.
No live Neon, production credentials, production migration or external GameSource
was used. Tests stay at the already confirmed service/PGlite and app seams.

| Check | Final result |
| --- | --- |
| Focused Lists + Journal service tests | 47 passed (2 files), 21.80 s |
| Focused list + upstream age/language browser journeys | 29 passed (4 files), 1.1 min |
| `pnpm lint` | Passed; 222 files; no errors or warnings |
| `pnpm typecheck` | Passed |
| Full Vitest | 439 passed (37 files), 31.81 s |
| Full production Playwright | 132 passed (22 files), 6.1 min; no failures, skips or retries |
| Migration upgrade + snapshot/timestamp validation | Passed locally in PGlite |
| Final `pnpm db:generate` | No drift |

```sh
pnpm test src/lib/lists.test.ts src/lib/journal.test.ts
E2E_PORT=3600 E2E_SUPPORT_PORT=3601 pnpm test:e2e \
  e2e/custom-lists-owner.spec.ts e2e/custom-lists-public.spec.ts \
  e2e/custom-lists.spec.ts e2e/game-facts.spec.ts --workers=2
pnpm lint
pnpm typecheck
pnpm test
E2E_PORT=3600 E2E_SUPPORT_PORT=3601 pnpm test:e2e --workers=2
pnpm db:generate
```

Vitest emitted existing Vite native-config and long-timeout warnings; the browser
harness emitted its expected unset social-provider and color-environment warnings.
The final full browser run includes all six upstream age/language journeys. Physical-device and manual screen-reader
checks were not performed; upstream #82 already records its manual screen-reader
check as outstanding. No push, PR creation/readiness change or issue closure was
performed. PR #90 remains draft for the parent's integration and final review.

## Earlier acceptance evidence (before upstream integration)

Verified November 3, 2026, on `t3/custom-lists-acceptance` in the isolated
`t3-75981519` worktree. Starting HEAD and integration baseline:
`468a911662f91b65f200f29a75e65ce1ac3b5340` (foundation #85, owner #86 and public #87 merged).
The tree was clean and starting ancestry was confirmed before changes.

### Boundary and results

Production `next build` + `next start`, Chromium, real signup/email verification/username
onboarding, isolated migrated PGlite and fake GameSource. All browser runs used
`E2E_PORT=3500 E2E_SUPPORT_PORT=3501` and this worktree's `.next-e2e` directory.
The harness blanks `DATABASE_URL` and provider credentials; no Neon or production
credentials, migrations or data were used. No new test seam was introduced.

| Check | Result |
| --- | --- |
| Existing owner/public baseline | 20 passed, 54.5 s |
| `pnpm test src/lib/lists.test.ts src/lib/journal.test.ts` | 46 passed (2 files), 21.47 s |
| `pnpm lint` | Passed, no warnings |
| `pnpm typecheck` | Passed |
| Focused production browser suite | 23 passed, 50.0 s |
| Full production browser suite | 126 passed (21 files), 6.1 min; no failures, skips or retries |

Reproduce the browser checks:

```sh
E2E_PORT=3500 E2E_SUPPORT_PORT=3501 pnpm test:e2e \
  e2e/custom-lists-owner.spec.ts e2e/custom-lists-public.spec.ts \
  e2e/custom-lists.spec.ts --workers=2
E2E_PORT=3500 E2E_SUPPORT_PORT=3501 pnpm test:e2e --workers=2
```

### Coverage map

The 13 owner and 7 public cases are retained. Three integrated cases in
[`e2e/custom-lists.spec.ts`](../../e2e/custom-lists.spec.ts) add the missing cross-surface journeys.

| #84 stories / contract | Evidence |
| --- | --- |
| 1–9, 24, 39: navigation, default Private, empty/duplicate lists, metadata retention | Owner creation, unavailable, session and sharing journeys; service text limits and no-op contracts |
| 10–18, 21: Catalog search, game picker, onboarding, overlap and duplicate membership | Owner Catalog/picker/onboarding cases; integrated lifecycle adds from both search and game page; service unique membership/overlap tests |
| 19–20, 43–44: persisted order, keyboard/touch, pagination and focus | Owner 50-game journey at 320 px moves index 47 across the 48 boundary and back, reloads, removes the last page and follows focus; overview Back/Forward/reload; public collection/detail pagination and clamping |
| 22–23: Journal independence | Integrated account journey compares entries, completion tags, status history, Playthroughs and notes before/after list changes; calendar events remain equal except response-generation DTSTAMP; Stats hours/Wishlist remain visible; removing Journal membership preserves both overlapping lists |
| 25–32, 35: publish, stable sharing URL, discovery, unpublish/republish | Integrated creator UI lifecycle with anonymous and unrelated-account reads; public profile count/cards refresh; rename retains canonical ID/URL and saved game order; empty public and private-only profile cases |
| 27: truthful clipboard recovery | Owner share case denies clipboard, verifies complete URL selection and list-specific error, restores native clipboard, then verifies actual copied canonical URL and cleared error |
| 33–34: private payload and metadata denial | Raw HTML, RSC/Flight and crawler metadata requests after UI unpublish return actual 404, no-store, noindex and no distinctive title/description/game; owner is also denied on a private public URL; public suite covers wrong creator, malformed/unknown/deleted IDs, generic image, public allowlist and preflight revocation race |
| 36, 41: session authority and ownership | Integrated test captures real build action IDs/arguments and directly POSTs create, edit, publish, add, remove, reorder and delete with anonymous, unrelated and old-owner/switched-actor identities; asserts structured authentication/not-found failures and unchanged owner export; malformed operation/order/visibility payloads rejected |
| 37–38: confirmed deletion, isolated data | Owner cancel/confirm flow, integrated lifecycle revokes deleted URL and profile card; service deletion contract preserves other lists/Journal/Catalog |
| 39–40: uncertain replies and stale saves | Existing committed-but-lost creation retry retains its submission key across reload and leaves one list; lost membership/delete/save reconcile before another write; two-tab stale edit cannot republish and retains draft; stale Move down now disabled until refresh |
| 42: auth continuation | Owner sign-in and signup/verification/username journeys return to selected game without writing Journal/list membership during authentication |
| 45–46: export and account deletion | Integrated authenticated export includes both visibility modes, timestamps, Catalog slugs and manual order without submission keys; UI account deletion invalidates stale session, both list URLs and calendar feed; another account's list/Journal/export and shared Catalog pages survive; existing PGlite lifecycle contracts verify row cascades |

### Defect and red/green evidence

The stale-edit journey initially failed because **Move down remained enabled** while
all other mutation controls required a refresh. The shared mutation handler already
blocked the write, but the active control misleadingly offered an unavailable action.
`OwnerListEditor` now applies `ready` and `needsRefresh` to Move down as it does to
Move up. The same browser assertion then passed (1 case, 16.0 s).

No authorization/privacy defect was found by the added action or publication checks.
While constructing the tests, fixture assumptions were corrected: Hades has no
platforms in the fake Catalog, calendar DTSTAMP changes per response, profile counts
need a main-content locator, and returning from the picker can require explicit saved-list
refresh because a per-tab draft has an older revision. These were test setup issues,
not production failures; no checks were skipped to accommodate them.

### Screenshots and limits

Representative captures from passing production-build journeys:

- [Owner desktop editor](../screenshots/custom-lists/owner-desktop.png)
- [Public list, 320 px](../screenshots/custom-lists/public-mobile.png)
- [Unpublished profile, 320 px](../screenshots/custom-lists/unpublished-profile-mobile.png)
- [Keyboard focus after crossing a page, 320 px](../screenshots/custom-lists/owner-mobile-keyboard-page-two.png)

Tests regenerate report attachments; committed images are evidence, not pixel baselines.

Browser coverage uses Chromium viewport emulation, not physical phones or a screen
reader. External artwork can depend on the network; unavailable-artwork recovery is
covered explicitly. Previously downloaded public content or external preview caches
cannot be recalled. No functional #84 requirement remains unresolved in the agreed acceptance scope.
The full Vitest run belongs to the parent integration task; this
worktree ran the 46 focused service/lifecycle tests above. No push, PR, issue closure
or production migration was performed.
