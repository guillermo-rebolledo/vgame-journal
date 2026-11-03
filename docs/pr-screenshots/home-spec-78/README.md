# Home findings 5–20

Evidence for issue #78, captured in Chromium from the production Next.js build
with isolated PGlite, fake GameSource, and local mailbox. All accounts and release
data are synthetic fixtures. No production account data is shown. Repeated Celeste
artwork and missing release metadata in the discovery fixtures are intentional.

- `before-guest-desktop.png`: original audit baseline `d4f0a08`, 1440px (before #77).
- `guest-{dark,light}-{390,1440}.png`: guest introduction, labelled search,
  account actions, illustrative examples, and discovery.
- `returning-{dark,light}-{390,1440}.png`: collection summaries, release preview,
  compact Playing/Recently added rows, and discovery.
- `search-light-{390,1440}.png`: controlled fictional Evergreen search results,
  active phone filters, returned-candidate count, selected primary platform,
  expanded additional-platform disclosure, and shared direct-save actions. The view is scrolled to search.

The eight guest/returning screenshots come from `e2e/home-spec-78.spec.ts` in the
final combined production run after #77 integration. The search views use the same controlled-request
browser seam with four illustrative candidates. Animations are disabled.

The workflows also check empty/one/two/many entries, 320px/tablet layouts, 200%
text enlargement, both themes, reduced motion, and forced-colors keyboard focus.
See [finding-by-finding acceptance evidence](acceptance.md).

No real screen-reader speech or physical-device check is represented by these
images. Browser semantics and keyboard checks do not establish spoken usability
or blanket WCAG conformance.

The accepted #77 implementation is integrated from main/PR #80. Final images
preserve its direct saves, explicit guest confirmation, shared saved-state labels,
and Status controls alongside this issue's summary/search/accessibility changes.
