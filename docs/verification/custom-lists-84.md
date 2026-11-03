# Custom Lists acceptance — #84 / #88

Verified November 3, 2026, on `t3/custom-lists-acceptance` in the isolated
`t3-75981519` worktree. Starting HEAD and integration baseline:
`468a911662f91b65f200f29a75e65ce1ac3b5340` (foundation #85, owner #86 and public #87 merged).
The tree was clean and starting ancestry was confirmed before changes.

## Boundary and results

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

## Coverage map

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

## Defect and red/green evidence

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

## Screenshots and limits

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
