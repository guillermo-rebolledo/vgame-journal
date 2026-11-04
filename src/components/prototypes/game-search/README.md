# Game search exploration

Run `pnpm dev` and open <http://localhost:3000/prototypes/game-search>.
The route returns 404 in production. Everything in this directory belongs to
the temporary exploration; production components never import it.

Command was selected and refined with better-interface. Read [REVIEW.md](REVIEW.md)
for the ranked findings, applied fixes, evidence, and remaining manual checks.
The production implementation is specified in [issue #105](https://github.com/guillermo-rebolledo/vgame-journal/issues/105),
published with to-spec and labeled ready-for-agent. Keep this reference until that
implementation is integrated; production search remains unchanged in this exploration.

| Variant | Interaction axis | Best for | Cost |
| --- | --- | --- | --- |
| Quick add | Actions on every result in an anchored panel | Saving several games | Busier rows |
| Command | Search, select a game, then choose an action in a modal | Focused keyboard use | Extra step before actions |
| Inspector | Compact results beside the selected game's actions | Browsing before saving | Larger panel, stacked on phones |

Use 1–3 or Left/Right outside text fields to switch, R to reset the current
variant, Command/Control K to open search, and Escape to close. Selection persists
in `?v=1`, `?v=2`, or `?v=3`. Demo controls expose loading, empty, and request
failure states. Search filters a small sample Catalog; saves update local state
and reset when the variant remounts. View game links open the app in another tab.

## Composition

The closest production component is `GameSearch`, whose inline result layout
is the subject of this exploration. It and its callers are unchanged. These
isolated compositions reuse `GameCover`, `Button`, `Input`, `Separator`, and the
existing Status menu primitives. They use the installed Base UI Popover, Dialog,
and Combobox for positioning, dismissal, focus, and keyboard selection. No
dependency was added. The shadcn Base UI command, combobox, popover, and dialog
registry implementations were consulted before composing the alternatives.

The picker CSS comes verbatim from the prototype skill. Existing popup motion
is reused. Status button colors switch instantly to avoid low contrast during
an inverted color transition. The Command picker is rendered inside the modal's
focus scope while it is open, so comparison remains available.

These are temporary components, not additions to the reusable component index
in `DESIGN.md`. After a direction is selected, integrate it into `GameSearch`,
preserve the real Catalog, URL filters, save/authentication, and list workflows,
add its production stories, update the index, and remove this exploration.

## Verification

- Lint and type checking passed.
- Full Storybook suite after refinement: 101 checks passed; prototype suite: 16 passed.
- Static Storybook build passed.
- `pnpm test:e2e e2e/accessibility.spec.ts`: all 8 checks passed.
- Browser checks covered every variant at 320, 390, 768, and 1440px in both themes:
  local saves, focus restoration, no horizontal page overflow, and unchanged
  Journal document position. No browser exceptions were observed.
- Open and saved states passed axe scans at 320 and 1440px in both themes with
  reduced motion. Picker persistence, keyboard selection, error/retry, empty
  recovery, missing artwork, long/non-Latin titles, and 200% text reflow were checked.
- Desktop and narrow screenshots were captured for all three variants.
- VoiceOver, a physical touch device, and a mobile software keyboard were not tested.
