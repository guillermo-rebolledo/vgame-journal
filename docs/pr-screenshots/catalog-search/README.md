# Cover-led Catalog search

The screenshots show the promoted production components against the local E2E Catalog: `/?q=ce`, with the search section scrolled into view. The browser is 390 × 900 in Light and 1440 × 900 in Dark. The result popup contains native game-page links; filters sit beside the field on desktop and wrap below it on phones.

Validation covers click/Enter/Space and modifier navigation, keyboard traversal and focus restoration, adjacent filters, stale/failed requests and retry, missing art/metadata, both themes at 320/390/768/1440px, and 200% text enlargement. Forced-colors focus and pointer/touch navigation are covered by the browser suite. Search and result state changes are immediate; there is no new motion to reduce.

VoiceOver and a physical phone with the software keyboard were not available for manual verification. The existing mocked visual-viewport tests still cover list and Playthrough editors. These screenshots are review assets, excluded from production deployment with the rest of `docs/`.
