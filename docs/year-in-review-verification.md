# Year in Review verification

Issue: #158. Edition: 2026. Baseline: repository HEAD before implementation (recorded below).

## Automated evidence

- Journal/PGlite and flag integration: 5 focused tests cover UTC boundaries and cutoff, every Status/imports, owner isolation, safe result fields, date overlap/open/future/replays, played-only, edits/removal/re-addition, truncation and deterministic ties, targeting and fail-closed evaluation.
- Full unit suite: 57 files, 671 tests passed under Node 24 with two workers. Unrestricted local concurrency exhausted resources and produced timeouts; the bounded run passed. Existing fake-clock tests emit timeout overflow warnings.
- Entire Storybook interaction/accessibility suite: 49 files, 246 tests passed. New stories include empty, played-only, long content, missing art, truncation, large counts, preparation, username changes and failure/retry, in both themes.
- Static Storybook build passed; catalog remains local/CI-only.
- Existing accessibility suite and initial review journeys: 16 tests passed, including Chromium, Firefox and WebKit download journeys.
- Production build passed. Export font appears in the route's traced server assets; no new package dependency.
- Final follow-up coverage: 6 browser journeys passed across Chromium, Firefox and WebKit. Coverage validates one through twelve PNG covers, full-year played-only output, populated reflow, keyboard controls and reduced motion. See the PR checks for final execution results.

## Production route JavaScript

Sum of unique client-reference chunks per route, before and after an optimized Next build. Gzip measured locally per chunk; these are route dependency totals, not a claim that every chunk transfers on every visit.

| Route | Before raw bytes | After raw bytes | Before gzip bytes | After gzip bytes |
| --- | ---: | ---: | ---: | ---: |
| Home | 559,370 | 559,438 | 196,938 | 196,812 |
| Stats | 455,093 | 455,161 | 160,607 | 160,481 |
| Year in Review | — | 451,695 | — | 158,843 |

Home and Stats each changed by 68 raw bytes; minification/compression makes their gzip totals slightly smaller. No export renderer or font enters a browser chunk. Review links disable prefetch. Image preparation performs no request before the player activates Preview PNG. No animation dependency was added.

## Cold authenticated navigation

Three fresh Chromium contexts per route with cache disabled, 390 × 844 viewport, 4× CPU throttling, 150ms latency, 200,000 bytes/s download and 90,000 bytes/s upload. Both versions use optimized isolated E2E builds and in-memory PGlite, not Neon. Baseline was built from an archive of the original HEAD in a temporary directory. Median DOMContentLoaded and observed script encoded-body totals:

| Route | Before median ms | After median ms | Before script bytes | After script bytes |
| --- | ---: | ---: | ---: | ---: |
| Home | 769.7 | 774.4 | 336,020 | 336,683 |
| Stats | 777.8 | 770.4 | 299,786 | 300,352 |
| Year in Review | — | 770.7 | — | 298,964 |

No material initial-load regression appeared in these local samples. This narrow DOMContentLoaded measurement is not an LCP or real-device field measurement. Development/test aliases and build hashing mean these byte totals differ from production manifest totals. No content is gated by motion; covers reserve dimensions and the PNG preview declares its fixed aspect ratio.

## Review

### Standards

Two minor findings addressed: added the product composition to the design Component index and reused the existing cover entrance keyframe. Motion review approved the 240ms, composite-only, capped stagger and reduced-motion handling.

### Spec

One P2 finding addressed: a JPEG with valid magic bytes but corrupt contents could break the whole export. Rendering now retries with deliberate missing-art placeholders. The browser journey injects a truncated JPEG and still verifies a real, downloadable PNG. The fallback may replace all selected covers if one cannot be decoded; the exact resulting image is previewed before download.

Review totals: Standards 2 minor findings, Spec 1 P2 finding; all addressed.

## Visual and manual limits

Inspected an actual generated PNG for text, Geist rendering, missing-art fallback, through-date and default username exclusion. The export adapts cover size for sparse selections; fixed dimensions remain 1080 × 1350. Browser assertions compare downloaded bytes with the displayed PNG blob, rather than independently recreating the image.

Automated checks exercise keyboard navigation/username toggle, both themes, 320/390/768/1440 widths, text enlargement, reduced motion and failure recovery. They cannot replace a human screen-reader and hardware pass. VoiceOver, physical iOS/Android save/share behavior, real touch, and visual focus/zoom inspection on hardware remain unchecked. Complete these before broadly enabling the flag. The feature defaults off until the owner explicitly enables it.
25a7e533fd34c5e70b05a23e530e3c07bfca8fb0
