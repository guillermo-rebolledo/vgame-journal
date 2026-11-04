# Command interface review

## Scope and coverage

Reviewed the selected Command prototype as a complete screen flow: trigger →
search → result selection → game actions → local save → Back/dismiss/reopen.
Inspected idle/sample results, narrowed results, loading, empty, request failure,
retry, selected game, confirmed local feedback, missing artwork/metadata, and
narrow layouts. This is a screen review, not a branch/diff review. Refinements
were authorized by the user's request to refine the selected direction.

Stack: Next.js App Router, React, Tailwind 4, installed Base UI, existing shadcn
Base UI components, Geist, and semantic OKLCH tokens. Convention sources read:
AGENTS.md, CLAUDE.md, DESIGN.md, GLOSSARY.md, docs/ui-catalog.md, and the existing
component stories and callers. No applicable CONTRIBUTING, CODING_STANDARDS,
or interface ADR was found. All six owning better-* skills were available,
read, and applied in the prescribed order.

The production search, provider persistence, sign-in continuation, and embedded
list editor were read to inform the implementation spec. They were not replaced
by this prototype review. Its local saves are not evidence of production integration.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Combobox/listbox relationships in all search states, accessibility tree, named controls, keyboard stage changes and focus restoration, live region, forced colors, axe | 3 findings fixed; physical screen-reader walk not verified |
| Layout | Modal sizing, visualViewport simulation, scrolling, stable geometry, Back/reopen behavior; both themes at 320/390/768/1440px; 200% text and RTL | 2 findings fixed |
| Writing | Visible label, action verbs, helper/error/recovery text, metadata against the glossary and existing unknown-metadata tests | 3 findings fixed |
| Typography | Rendered titles/metadata, 16px mobile input, Geist/weight hierarchy, wrapping, long/non-Latin text, tabular counts, bidi isolation | Clear after inspection |
| Colors | Actual input border/background pairs, text on the active-result background, both themes, forced-color indicator | 2 findings fixed |
| UI polish | Semantic surfaces, image outlines, radii, icon library, press/static behavior, instantaneous repeated interactions, scroll containment | Clear after inspection; no new motion needed |

## Findings

All locations below refer to the refined source implementing the replacement.
Before records the inspected original behavior; After records the applied fix.
Each row is one root cause, ranked by impact. All ten are resolved in the prototype.

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Accessibility | `src/components/prototypes/game-search/command.tsx:209` | SearchState replaced the entire Combobox.List in loading, empty, and error states; expanded input lost aria-controls and axe reported aria-required-attr | Always mount the named listbox; give it zero actionable options while loading/failed; keep recovery buttons outside it | The widget's promised keyboard/assistive-technology relationship must remain valid through recovery |
| HIGH | Accessibility | `src/components/prototypes/game-search/command.css:31` | Active option used only data-highlighted:bg-muted plus outline-none; forced-colors produced the same white background and black text for both rows, with no outline | Add a 2px inset foreground outline and system Highlight override; verify solid 2px in forced colors | Color-only navigation disappeared for high-contrast users |
| HIGH | Layout | `src/components/prototypes/game-search/command.tsx:28`, `src/components/prototypes/game-search/command.css:1` | top:15dvh/max-height:70dvh ignored the smaller visual viewport; simulated 300px keyboard viewport left the popup at y=126.6–514.6; content-dependent height also moved the shell between states | Reuse useEditorViewport; constrain and center a stable shell inside its visible area, with a bounded scrolling body and reachable Close; simulation now y=56–284 | Keyboard occlusion can hide controls and block the task; stable geometry also prevents routine result changes moving the shell |
| HIGH | Colors | `src/components/prototypes/game-search/command.css:27` | Shared Input's border token measured 1.26:1 in light and 1.60:1 in dark against its rendered input surface, below the 3:1 essential-boundary requirement | Local semantic foreground/popover mix measures 6.39:1 light and 5.44:1 dark; system ButtonText boundary in forced colors | A quiet decorative hairline is insufficient for the actual input boundary; no global palette change was needed |
| HIGH | Colors | `src/components/prototypes/game-search/command.css:36`, `src/components/prototypes/game-search/shared.tsx:284` | Muted metadata over the light active-row fill formed the failing #737373/#f5f5f5 pair, measured at 4.34:1 against a 4.5:1 requirement | Active-row metadata uses semantic foreground; rendered narrowed-result axe scans pass in both themes | A token that passes on the page can fail on the selected surface |
| MEDIUM | Accessibility | `src/components/prototypes/game-search/command.tsx:287` | Static Matching games label, no settled-count live update, and old save feedback remained visible in subsequent searches | Stable atomic polite output for loading/count/save updates; clear old feedback on Back, game change, and close; restore input focus on retry | Dynamic updates must be understandable without moving focus or reading obsolete feedback |
| MEDIUM | Layout | `src/components/prototypes/game-search/command.tsx:41`, `src/components/prototypes/game-search/command.tsx:122` | Closing on a game's actions reopened that old stage; Back remounted the results subtree | Reopen into Search with query retained; keep results mounted while hidden; Back preserves input value and active descendant; Command/Control K returns to search | Repeated search should resume the browsing task predictably rather than require navigating out of the previous game |
| MEDIUM | Writing | `src/components/prototypes/game-search/command.tsx:128` | Search label was sr-only and placeholder repeated Search games | Persistent visible Search games label, example placeholder, and Choose a game to see its actions helper | A placeholder disappears on entry and cannot carry the field's visible identity |
| MEDIUM | Writing | `src/components/prototypes/game-search/shared.tsx:285` | Null year was rendered as Release unannounced; sample platform value said Platform unannounced | Year unavailable and Platform availability unknown, matching production terminology | Missing historical metadata does not establish that a release is forthcoming |
| LOW | Writing | `src/components/prototypes/game-search/command.tsx:266` | Four bare Status labels with independent aria-pressed toggles implied a selection setting without explaining the immediate save | Explicit Save to Status actions, separate Current status text and check, no independent toggle semantics | The visible label now states what activation does; current state stays explicit without relying on fill color |

## Verification

Passed:

- `pnpm typecheck` and `pnpm lint`.
- `pnpm test:storybook`: full catalog passed 101 checks; selected prototype stories
  cover keyboard save/back/reopen, empty recovery and list relationship, failed
  search/retry/focus, loading, missing metadata, and both themes.
- `pnpm build-storybook`: static catalog built successfully. Existing dependency
  directive/deprecation warnings did not fail the build.
- `pnpm test:e2e e2e/accessibility.spec.ts`: all 8 production regression checks passed.
- Playwright browser walk in both themes at 320, 390, 768, and 1440px: open → type
  Hollow → ArrowDown/Enter → Save to Backlog → Back; query and active descendant
  were retained. Empty results kept a valid controlled listbox and passed axe;
  clear recovered all sample results. Close restored trigger focus. No horizontal
  page overflow was observed.
- Rendered narrowed-result axe scans passed after the active-row metadata fix.
- Forced-colors/reduced-motion emulation: active option retained a solid 2px
  system-color outline. This command flow introduces no opening/stage motion.
- 320px, 200% text, RTL, non-Latin/long title and absent artwork: action and save
  remained usable without horizontal page overflow. No title clamp was added.
- Synthetic visualViewport height of 300px: the dialog stayed within y=56–284;
  search, selection, saving, Close, and focus restoration all remained reachable.
- Input-border measurements used composited computed colors against the actual
  rendered surface. Baseline was reconstructed with the unchanged shared input
  token; the refinement stays local to Command.
- Screenshots captured for results and actions in both themes at the supported widths.

Not verified:

- VoiceOver or another real screen reader; live-region markup and accessibility
  trees do not prove spoken output. Verify single announcements before shipping.
- A physical touch device or actual mobile software keyboard. Synthetic visual
  viewport checks are regression coverage, not hardware verification.
- True browser zoom (200% text enlargement was checked), actual touch hover, and
  screen-reader behavior in Windows high contrast.
- Production save, authentication continuation, and embedded list-command behavior
  for this future implementation. The specification includes acceptance tests for them.

## Verdict

**Approve** the refined prototype within the coverage above. No confirmed HIGH,
MEDIUM, or LOW finding remains in this reviewed surface. This verdict does not
claim production integration or completion of the explicitly unverified manual checks.
