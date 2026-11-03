---
name: shelve.games
description: A personal journal of every game you've played and every game you're waiting for.
colors:
  graphite: "oklch(0.205 0 0)"
  bone: "oklch(0.922 0 0)"
  paper: "oklch(1 0 0)"
  ink: "oklch(0.145 0 0)"
  shelf-black: "oklch(0.145 0 0)"
  shelf-card: "oklch(0.205 0 0)"
  chalk: "oklch(0.985 0 0)"
  dust: "oklch(0.97 0 0)"
  dust-dark: "oklch(0.269 0 0)"
  pencil: "oklch(0.556 0 0)"
  pencil-dark: "oklch(0.708 0 0)"
  hairline: "oklch(0.922 0 0)"
  hairline-dark: "oklch(1 0 0 / 10%)"
  ring: "oklch(0.708 0 0)"
  ring-dark: "oklch(0.556 0 0)"
  ember: "oklch(0.577 0.245 27.325)"
  ember-dark: "oklch(0.704 0.191 22.216)"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  sheet: "32px"
  full: "9999px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  button-primary-dark:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  button-destructive:
    textColor: "{colors.ember}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  input:
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "16px"
  notice:
    backgroundColor: "{colors.dust}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  nav-link:
    textColor: "{colors.pencil}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "44px"
  game-cover:
    rounded: "{rounded.lg}"
    width: "264px"
    height: "374px"
---

# Design System: shelve.games

## Overview

This is the working baseline for design decisions, recorded from the current app. Runtime tokens and behavior live in the components and `src/app/globals.css`; `.impeccable/design.json` is a reference snapshot for design tools, not a second runtime stylesheet. Update the guidance and snapshot when the design changes. Product terms are defined in [GLOSSARY.md](GLOSSARY.md).

**Creative North Star: "The Quiet Shelf"**

shelve.games is a shelf, not a storefront. The interface around the games is graphite, bone and paper. It recedes so that the cover art can be the loudest and most colorful thing on screen. A collection should look like a well-kept bookshelf: ordered, calm, and personal. It should not look like a marketing page competing with the games for attention.

Density is moderate. Text is small and precise (14px body), headings are tight and semibold, and the layout is a single centered column that widens into cover grids. Depth comes from hairline borders and slightly darker tonal panels. Shadows are reserved for physical objects, meaning covers and floating layers. Motion is short, decelerating and mostly invisible. The few moments of delight, such as confetti on finishing a game, rolling counters and covers that tilt, are kept for moments that mean something to the player.

The surfaces are **Operate** mode: a person is completing a task, such as finding a game, saving it, or logging a playthrough. Familiar patterns win over novelty. Brand shows in precise details, not in decoration.

**Key Characteristics:**
- Monochrome chrome; cover art supplies the color.
- Geist throughout, semibold with tight tracking for headings and tabular figures for numbers.
- Flat, bordered surfaces; shadows only on covers and floating layers.
- One gentle radius family built from a 10px base.
- Fast ease-out motion under 300ms, with a reduced-motion branch for every animation.
- Delight saved for meaningful moments: finishing a game, saving one, watching a count change.

## Colors

The palette is a strictly achromatic gray ramp in OKLCH, with zero chroma. It's mirrored for light and dark themes, and the only hue is red for destructive actions.

### Primary
- **Graphite** (light) / **Bone** (dark): the single filled emphasis in any view. Use it for the primary button and for the selected option in a group of choices. Its text is Chalk in light mode and Graphite in dark mode.

### Neutral
- **Paper** (light) / **Shelf Black** (dark): page background, and the background for cards and inputs.
- **Shelf Card** (dark only): the raised surface for cards and popovers in dark mode. In light mode cards share Paper.
- **Ink** (light) / **Chalk** (dark): body text, headings and icons.
- **Dust** (light) / **Dust Dark**: tonal panels (`muted`, `secondary`, `accent`), hover fills, skeletons and the "No cover art" fallback. Notices use it at 40% opacity.
- **Pencil** (light) / **Pencil Dark**: secondary text such as metadata, captions, inactive navigation and placeholders. Check the actual foreground/background pair, including opacity and hover fills, for AA contrast; a token name alone does not guarantee contrast.
- **Hairline** (light) / **Hairline Dark**: borders, dividers and input strokes. Dark mode uses 10% white rather than a solid gray, so borders stay quiet over any surface.
- **Ring** / **Ring Dark**: focus rings, used at 50% opacity in the standard 3px ring.

### Status
- **Ember** (light) / **Ember Dark**: destructive actions and validation errors only. It appears as a tint behind red text (10–20% fill), never as a solid red button.

### Named Rules
**The Covers Carry Color Rule.** Interface chrome stays achromatic. The only hues on screen come from cover art, Ember for destructive or error states, and celebration particles. A new accent color needs a deliberate decision and an update to this file. It never appears as a one-off.

**The Celebration Exception.** The finish-game confetti (`burst-button.tsx`) uses the raw Tailwind amber, emerald, sky, rose and violet `400` colors. It's the only place raw palette classes are allowed, because a celebration is a moment, not chrome.

**The Semantic Tokens Only Rule.** Components use semantic utilities such as `bg-primary`, `text-muted-foreground` and `border-border`. Never use raw palette classes like `bg-zinc-800`, and never hard-code an OKLCH value. Every token is defined in `src/app/globals.css`, in `:root` and `.dark`.

## Typography

**Display, body and label font:** Geist, loaded with `next/font` as `--font-sans`, with system-ui fallbacks
**Mono font:** Geist Mono, for technical strings like export tokens and IDs

**Character:** One neutral grotesk carries everything. Hierarchy comes from weight and tracking, not from mixing typefaces. Headings are semibold with slightly tight tracking (-0.025em). Body text stays at a regular weight.

### Hierarchy
- **Display** (600, 2.25rem on phones and 3rem from `sm`, line height 1, tight tracking): one per page at most, for the guest hero and a game's title on its detail page. Use `text-balance`.
- **Headline** (600, 1.875rem, tight tracking): page titles such as "Your Journal", Library and Wishlist.
- **Title** (600, 1.25rem): section headings within a page, such as "Playing" and "Recently added".
- **Body** (400, 0.875rem, line height 1.43): everything else. Inputs render at 1rem on phones so iOS doesn't zoom, and drop to 0.875rem from `md`. Keep prose under 65ch with `max-w-prose`.
- **Label** (500, 0.75rem): metadata, badges and captions under covers.

### Named Rules
**The Tabular Figures Rule.** Any number that changes or sits in a column uses `tabular-nums`, including counts, stats, odometers and countdowns. Digits must not jitter.

**The Weight Ladder Rule.** Use only three weights: 400 for reading, 500 for labels and active states, and 600 for headings. Don't use 700.

## Layout

There's one centered column. The site frame (header and footer) caps at 72rem (`max-w-6xl`) with 16px gutters. Focused forms and reading content cap at 36rem (`max-w-xl`). Cover grids use the full frame and step from 2 columns on phones to 4 or more on desktop. Covers keep their 264:374 aspect ratio at every size.

Spacing follows Tailwind's 4px grid. Related items sit 8–12px apart (`gap-2`, `gap-3`), groups inside a section 16px apart (`gap-4`), and page sections 24–32px apart (`gap-6`, `space-y-8`). Card padding is 16px, and empty states expand to 32px from `sm`.

Navigation wraps onto a second row on phones instead of collapsing into a menu. Every primary navigation target is at least 44 × 44px (`min-h-11 min-w-11`). The layout must not overflow horizontally at any width down to 320px.

## Elevation & Depth

The system is flat. Hairline borders and Dust panels separate surfaces, and shadows mean that something is a physical object or floats above the page.

### Shadow Vocabulary
- **Cover on the shelf** (`shadow-lg`): every cover in a grid or shelf. It makes the art read as a physical box.
- **Hero cover** (`shadow-2xl`): the single large cover on a game's detail page.
- **Floating layer** (`shadow-md` or `shadow-lg` plus `ring-1 ring-foreground/10`): popovers, menus, selects and hover cards. The ring keeps the edge visible in dark mode, where shadows disappear.

### Named Rules
**The Objects, Not Surfaces Rule.** Shadows belong to covers and floating layers. Cards, notices, inputs and empty states never get a shadow. They use a hairline border, or Dust at 40% opacity.

## Shapes

Corners are gently rounded and all come from one scale built on `--radius: 0.625rem`:
- **10px** (`rounded-lg`): buttons, inputs, cards, covers and popovers.
- **8px** (`rounded-md`): navigation links and small controls.
- **14px** (`rounded-xl`): dialogs.
- **32px**: the playthrough editor drawer.
- **Pill** (`rounded-full`): avatars and icon-only buttons.

Nested elements stay concentric: an inner radius is the outer radius minus the padding between them. Empty states use a dashed border to say "nothing here yet". Every other border is solid.

## Components

Before building anything, search the Storybook catalog (`pnpm storybook`) and read the relevant stories, implementations, and callers in `src/components/`. Check the shadcn registry if no local component fits. See [the catalog workflow](docs/ui-catalog.md) and `AGENTS.md`.

### Component index

Paths below are relative to `src/components/`. Read the implementation and an existing caller before composing a variant. This index points to reusable implementations; it does not introduce wrappers for plain layout.

| Need | Existing implementation | Usage guidance |
| --- | --- | --- |
| Actions and form controls | `ui/button.tsx`, `ui/input.tsx`, `ui/label.tsx`, `ui/field.tsx`, `ui/select.tsx` | Use variants and associated field messages. |
| Menus and floating layers | `ui/dropdown-menu.tsx`, `ui/tooltip.tsx`, `ui/hover-card.tsx`, `ui/drawer.tsx` | Preserve Base UI keyboard handling, names, and focus management. |
| Avatars, dividers, placeholders | `ui/avatar.tsx`, `ui/separator.tsx`, `ui/skeleton.tsx` | Shared visual primitives. |
| Covers and failed media | `game-cover.tsx`, `fallback-image.tsx`, `tilt-cover.tsx` | Reuse the cover ratio, missing-art fallback, and reduced-motion behavior. |
| Game identity | `game-identification-metadata.tsx`, `platform.tsx`, `game-facts.tsx` | Keep game titles and platform labels consistent. |
| Save or change Status | `journal-status.tsx`, `game-recording.tsx`, `home-cover-link.tsx` | Separate the game link from its recording actions. |
| Playthrough recording | `playthrough-form.tsx`, `playthrough-history.tsx` | Reuse validation, draft retention, and editor dismissal behavior. |
| Search and discovery | `game-search.tsx`, `discovery-content.tsx`, `tag-shelves.tsx` | Preserve result, retry, and empty states. |
| Collections | `library.tsx`, `wishlist.tsx`, `paged-list.tsx`, `collection-loading.tsx` | Reuse filtering, pagination, and collection loading patterns. |
| Header and navigation | `main-nav.tsx`, `account-menu.tsx`, `skip-link.tsx` | Maintain current-page state and keyboard access to main content. |
| Copying and feedback | `copy-button.tsx`, `feedback.tsx` | Reuse success, failure, and manual-copy recovery. |
| Meaningful motion | `burst-button.tsx`, `odometer.tsx`, `page-transition.tsx` | Use only for the purposes defined below. |

### Buttons
- **Shape:** 10px radius, 32px minimum height and 10px side padding. `lg` is 36px. Icon-only buttons are square (`icon` is 32px).
- **Primary:** a Graphite or Bone fill. Use at most one per view.
- **Outline:** a hairline border on Paper; the common secondary action.
- **Ghost:** no fill until hover. Use for toolbars and menu triggers.
- **Destructive:** Ember text on a 10% Ember tint. It's never a solid red fill.
- **States:** hover darkens the fill to 80% or adds a Dust fill. Pressing nudges the button down 1px. Focus shows the standard 3px ring at 50% opacity. Disabled is 50% opacity with no pointer events.

### Inputs / Fields
- **Style:** a hairline stroke, transparent fill (`input/30` in dark mode), 10px radius and 32px height. The search field wraps its input and controls in one focus-within container.
- **Focus:** the border changes to Ring and the 3px ring appears.
- **Error:** an Ember border and Ember ring at 20%, driven by `aria-invalid`. Messages go in `Field` primitives so they stay programmatically associated with the input.

### Cards / Containers
- **Card:** a 10px radius and hairline border with 16px padding. No shadow.
- **Notice:** a hairline border on Dust at 40%, with 12–16px padding. It enters with the `.enter` class.
- **Empty state:** a dashed border with 16px padding (32px from `sm`), left-aligned. It has one sentence and one action.

### Navigation
- **Style:** Pencil text-sm links with an underline on hover. The current page uses Ink, weight 500 and a 2px underline, driven by `aria-current="page"`.
- **Targets:** at least 44px. A skip link comes first in tab order.

### Floating layers (menus, selects, tooltips, hover cards, dialogs)
- Use the Base UI primitives in `src/components/ui/` and don't hand-roll these.
- Popovers scale from their trigger with `origin-(--transform-origin)`. Dialogs stay centered.
- They use the floating-layer shadow, with 4–10px internal padding.

### Game cover (signature)
- Use `GameCover`, which applies the 264:374 aspect ratio, `object-cover` and lazy loading.
- The cover is decorative (`alt=""`); the adjacent title names the link.
- It uses the cover-on-shelf shadow and 10px radius in grids. Compact rows use 48px-wide thumbnails with a smaller radius and no shadow.
- Missing art shows a Dust tile with an ImageOff icon and "No cover art". Never leave an empty box.
- `TiltCover` adds pointer tilt and glare, and scales to 0.96 when pressed. Both are disabled under reduced motion.

### Delight components (signature)
- **BurstButton:** confetti when a toggle switches on, never when it switches off. It renders nothing under reduced motion.
- **Odometer:** rolling digits for counts that change. It provides a screen-reader-only text value with `aria-hidden` digits.
- These use 900ms motion. The existing game-detail backdrop also has a 40s ambient drift, gated by `motion-safe`; keep that exception confined to the noninteractive backdrop. Add new delight only for moments that matter to the player.

### Motion
Motion is implemented in `globals.css` and the components; `.impeccable/design.json` records the reference values.
- **Curve:** `cubic-bezier(0.22, 1, 0.36, 1)`, a strong ease-out, for entering, disclosure, routes and covers. Use plain `ease-out` for exits.
- **Durations:** exits 140ms, disclosure and inserted content 200ms, routes and cover entry 220ms, cover morph 280ms.
- **Route changes** use view transitions: the old page fades out and the new one fades up 6px.
- **Inserted content** uses `.enter`: CSS transitions with `@starting-style` and a 4px rise, so it can be interrupted.
- Every animation has a `prefers-reduced-motion: reduce` branch that removes movement and keeps opacity only where it helps.

## UX and copy

- Use the terms in `GLOSSARY.md`. Name destinations and Status choices consistently; use sentence case for other labels. Prefer specific verbs: “Add to Journal”, “Add playthrough”, “Remove from Journal”.
- A Playthrough finish date and a game's Status are independent. Explain that distinction where it affects a choice. A new release never silently moves a Wishlist game to Backlog or Playing.
- Keep the user's task and entered values through sign-in, validation, or a failed save. Show pending feedback immediately, prevent duplicate submission, and announce confirmed success once. A failed save needs a retry action and a useful explanation.
- Distinguish an empty Journal, no matching search results, loading content, and a failed request. Give an empty state a clear next action; give a failure a recovery action. Keep previously loaded content available when possible.
- Explain what will be removed before destructive actions and retain the existing confirmation or undo behavior. State when notes are private. Do not imply that saving a game means owning or buying it.
- Truncate secondary metadata only when the full value remains available. Let titles, errors, notes, and button labels wrap; test long titles, missing cover art, non-Latin text, and large counts.

## Accessibility and verification

Target WCAG 2.2 AA. Base UI provides interaction foundations; the composed page still needs meaningful labels, appropriate semantics, sufficient contrast, and usable focus behavior.

- Use native links for navigation and buttons for actions. Give icon-only controls an accessible name. When adding game context to a text button's accessible name, keep its visible label intact at the start (for example, “Add to backlog for Celeste”). Keep heading order meaningful and one main landmark per page.
- Associate visible labels and help/error messages with their controls. Set `aria-invalid` on invalid fields; announce asynchronous success and errors without moving focus unexpectedly.
- Menus and drawers must open by keyboard, keep focus in modal content, dismiss with Escape, and return focus to the initiating control. Pointer gestures need a keyboard alternative.
- Text needs 4.5:1 contrast (3:1 for large text); essential control boundaries and state indicators need 3:1 against adjacent colors. Quiet decorative borders are not sufficient as the only way to identify an input. Check focus on actual surfaces and cover art.
- Controls need at least 24 × 24 CSS px targets or the WCAG spacing exception; prefer 44 × 44 for touch. Keep focus visible and unobscured by sticky or floating content.

`e2e/accessibility.spec.ts` uses `@axe-core/playwright` to scan guest pages, search results, populated personal pages, the public profile, the Journal menu, and the playthrough editor including validation, in both themes. It runs in the existing E2E CI job. Serious and critical WCAG A/AA violations fail the test; complete results (including lower-impact violations and checks needing review) are attached as JSON. Fix root causes rather than excluding selectors or disabling rules to obtain a pass. Follow the [Playwright accessibility testing guide](https://playwright.dev/docs/accessibility-testing) when extending coverage.

Before shipping an affected flow, record these manual checks and their results in the change description:

1. Keyboard only: reach every action, see focus, open and dismiss overlays, recover focus after save/cancel, and use the skip link.
2. VoiceOver or another screen reader: confirm names, heading navigation, field errors, private-note guidance, and single success announcements.
3. Both themes at 320, 390, 768, and 1440px; 200% zoom and text enlargement; reflow without lost actions or horizontal page scrolling. Check mobile overlays with the software keyboard open.
4. Reduced motion enabled, touch interaction without sticky hover, long content, absent images, and loading, empty, error, and retry states.

Automated scans cover rendered states and cannot establish full accessibility compliance. Screen-reader usability, reflow, focus visibility, and interaction quality still require the checks above.

## Design tools and maintenance

Use [Emil Kowalski's skills](https://github.com/emilkowalski/skills) as craft guidance: `emil-design-eng` for interaction details, `animate` for choosing whether and how to animate, and `review-animations` for reviewing motion. This app's restrained visual direction and existing press feedback take precedence over generic stylistic defaults. Use `impeccable` for broader UI critique. Read the relevant skill when doing that work; installing additional tooling is not required to read this design system.

For each UI change, identify the existing component and pattern being reused, update this document if the pattern changes, and include automated and manual verification results. A new reusable component gets an entry in the index and colocated Storybook stories. Record a durable design trade-off in `docs/adr/` when its rationale would otherwise be lost. Storybook is the interactive component catalog; a custom registry and Figma integration remain deferred.

## Do's and Don'ts

### Do:
- **Do** let cover art be the color. Keep chrome in the gray tokens.
- **Do** use semantic token utilities (`bg-muted`, `text-muted-foreground`, `border-border`).
- **Do** use `tabular-nums` on changing or aligned numbers, and `text-balance` on headings.
- **Do** keep primary navigation and touch targets at least 44px, and other controls at least 24px (WCAG 2.2 target size).
- **Do** keep a visible focus indicator on every interactive element. Next to cover art, use the solid 3px Ink outline with a 3px offset (the `.journal-action` pattern), because a translucent ring disappears against artwork.
- **Do** keep the link to a game and the actions on it, such as save and status, as separate targets. Never nest buttons inside links.
- **Do** keep UI animations under 300ms with the ease-out curve, and give each one a reduced-motion branch.
- **Do** make popovers grow from their trigger, and use CSS transitions rather than keyframes for anything a user can interrupt.
- **Do** check both themes and widths of 320, 390, 768 and 1440px before shipping.

### Don't:
- **Don't** introduce a new hue, gradient or colored accent in chrome without updating this file first.
- **Don't** put shadows on cards, notices, inputs or empty states.
- **Don't** add new radius values or arbitrary pixel sizes. Use the scale.
- **Don't** use `ease-in` for UI motion, animate from `scale(0)`, or animate actions triggered by the keyboard or repeated often.
- **Don't** add decorative motion, such as fade-ins on every section, staggered lists everywhere, or confetti for routine saves.
- **Don't** use 700-weight text or more than one display-size heading per page.
- **Don't** hand-roll a dialog, menu, select, tooltip or drawer. Use the Base UI primitives in `src/components/ui/`.
- **Don't** communicate status with color alone. Pair it with a label or icon.
