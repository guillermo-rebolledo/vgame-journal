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
  ember: "oklch(0.5 0.2 27.325)"
  ember-dark: "oklch(0.704 0.191 22.216)"
  keepsake-paper: "oklch(0.97 0.012 95)"
  keepsake-ink: "oklch(0.2 0 0)"
  keepsake-marker: "oklch(0.93 0.15 108)"
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
- Browser chrome uses the header's Paper (`#ffffff`) / Shelf Black (`#0a0a0a`) through `ThemeProvider`'s `theme-color` metadata, following the resolved Light, Dark or System selection. The manifest retains Shelf Black as its launch/default color, matching the app's Dark default; browser support determines which browser surfaces are tinted.
- **Shelf Card** (dark only): the raised surface for cards and popovers in dark mode. In light mode cards share Paper.
- **Ink** (light) / **Chalk** (dark): body text, headings and icons.
- **Dust** (light) / **Dust Dark**: tonal panels (`muted`, `secondary`, `accent`), hover fills, skeletons and the "No cover art" fallback. Notices use it at 40% opacity.
- **Pencil** (light) / **Pencil Dark**: secondary text such as metadata, captions, inactive navigation and placeholders. Check the actual foreground/background pair, including opacity and hover fills, for AA contrast; a token name alone does not guarantee contrast.
- **Hairline** (light) / **Hairline Dark**: borders, dividers and input strokes. Dark mode uses 10% white rather than a solid gray, so borders stay quiet over any surface.
- **Ring** / **Ring Dark**: focus rings, used at 50% opacity in the standard 3px ring.

### Status
- **Ember** (light) / **Ember Dark**: destructive actions and validation errors only. It appears as a tint behind red text (10–20% fill), never as a solid red button. The light-theme Ember is dark enough for normal-size text to retain AA contrast over both tint strengths.

### Named Rules
**The Covers Carry Color Rule.** Interface chrome stays achromatic. The only hues on screen come from cover art, Ember for destructive or error states, and celebration particles. A new accent color needs a deliberate decision and an update to this file. It never appears as a one-off.

**The Keepsake Exception.** The Year in Review sheet is a printed object, not chrome. It uses three tokens that are the same in both themes: **Keepsake Paper** (warm off-white), **Keepsake Ink** (text, rules and the hero block) and **Keepsake Marker** (one highlighter yellow, for the hero count, the logo cell and the busiest month). They appear inside that sheet and its matching Home invitation. Links on the sheet take an Ink focus outline, because the theme foreground disappears against Paper in Dark.

**The Celebration Exception.** The finish-game confetti (`burst-button.tsx`) uses the raw Tailwind amber, emerald, sky, rose and violet `400` colors. It's the only place raw palette classes are allowed, because a celebration is a moment, not chrome.

**The Semantic Tokens Only Rule.** Components use semantic utilities such as `bg-primary`, `text-muted-foreground` and `border-border`. Never use raw palette classes like `bg-zinc-800`, and define OKLCH values as tokens. Content-image edges use the deliberately pure black/white `--image-outline` token, rather than a palette gray. Every token is defined in `src/app/globals.css`, in `:root` and `.dark`.

## Typography

**Display, body and label font:** Geist, loaded with `next/font` as `--font-sans`, with system-ui fallbacks
**Mono font:** Geist Mono, for technical strings like export tokens and IDs, and for the whole Year in Review page

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

Navigation wraps onto a second row on phones instead of collapsing into a menu. The account trigger follows the navigation at its right edge; Feedback opens the existing drawer from the account menu, returning focus to the account trigger on dismissal. Every primary navigation target is at least 44 × 44px (`min-h-11 min-w-11`). The layout must not overflow horizontally at any width down to 320px.

## Elevation & Depth

The system is flat. Hairline borders and Dust panels separate surfaces, and shadows mean that something is a physical object or floats above the page.

### Shadow Vocabulary
- **Cover on the shelf** (`shadow-lg`): every cover in a grid or shelf. It makes the art read as a physical box.
- **Hero cover** (`shadow-2xl`): the single large cover on a game's detail page.
- **Floating layer** (`shadow-md` or `shadow-lg` plus `ring-1 ring-foreground/10`): popovers, menus, selects and hover cards. The ring keeps the edge visible in dark mode. A solid transparent 1px border supplies the edge in forced colors, where shadows disappear.

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
| Account deletion | `delete-account-form.tsx` | Embedded Settings password verification or a verified-email code for Google-only accounts, then typed DELETE; server callbacks enforce a short-lived proof. |
| Revoke account sessions | `sign-out-all-form.tsx` | Embedded Settings action with pending feedback, inline errors and retry. |
| Actions and form controls | `ui/button.tsx`, `ui/input.tsx`, `ui/label.tsx`, `ui/field.tsx`, `ui/select.tsx` | Use variants and associated field messages. |
| Menus and floating layers | `ui/dropdown-menu.tsx`, `ui/tooltip.tsx`, `ui/hover-card.tsx`, `ui/drawer.tsx` | Preserve Base UI keyboard handling, names, and focus management. |
| Loading and pending actions | `ui/spinner.tsx`, `ui/button.tsx` (`loading`), `content-loading.tsx`, `collection-loading.tsx` | Static skeletons for initial content reads; Compass with shimmering text for ongoing work. Keep each flow’s existing live feedback owner. |
| Avatars, dividers, placeholders | `ui/avatar.tsx`, `ui/separator.tsx`, `ui/skeleton.tsx` | Shared visual primitives. Skeletons fit their containing column, including with enlarged text. |
| Seasonal Home invitation | `review-invitation.tsx` | Composes Button and Link; a real review visit reveals session dismissal and an account-wide, year-scoped hide choice. |
| Seasonal Journal keepsake | `year-in-review.tsx` | Owner-only 2026 page in Geist Mono: a ruled 4:5 sheet in the Keepsake tokens beside the deferred exact-PNG preview/download. Separate from Stats charts; reuse its existing primitives. |
| Covers and failed media | `game-cover.tsx`, `fallback-image.tsx`, `tilt-cover.tsx` | Reuse the cover ratio, missing-art fallback, and reduced-motion behavior. |
| Game identity and facts | `game-identification-metadata.tsx`, `platform.tsx`, `game-facts.tsx`, `game-facts-grid.tsx` | GameFactsGrid composes known cards and compact unavailable metadata, with a server-rendered regional age-rating slot. Facts and remaining platforms reuse HoverCard through `useHoverDisclosure` with a visible disclosure cue; Languages owns its scroll containment. |
| Save or change Status | `journal-status.tsx`, `game-recording.tsx`, `home-cover-link.tsx` | Separate the game link from its recording actions. Detail pages compose list controls through GameRecording; JournalStatus groups additional actions before its feedback. |
| Give or clear a Rating | `star-rating.tsx` (`StarRating`) | A native radio group of ten half-star options (24 × 44px targets) over RatingStars, plus Clear rating. Choices show at once, save one at a time so the last choice wins, roll back with a retry on failure and announce once. Outside Played or Playing a kept Rating is read-only RatingStars with Clear rating. |
| Community rating | `community-rating.tsx` (`CommunityRatingFact`, `CommunityRatingBoundary`) | A full-width card in GameFactsGrid's `communityRating` slot, streamed in its own Suspense and error boundary. Average out of 5 with the count and a distribution whose exact values sit in View rating data; below the threshold only the count so far. The data table fades in on pointer opening: opacity 0 → 1 over 200ms with the shared entrance curve; reduced motion uses 0.8 → 1 over 150ms ease-out. Layout, closing and keyboard opening stay immediate. |
| Playthrough recording | `game-recording.tsx`, `playthrough-form.tsx`, `playthrough-history.tsx` | Reuse validation, draft retention, and editor dismissal behavior. Deleting a Playthrough returns focus to Add playthrough even when refreshed history arrives later. |
| Home game rows | `home-journal.tsx`, `discovery-content.tsx` | Grid shelves share cover, wrapping title, metadata and action rows through CSS subgrid so long titles keep neighboring actions aligned. A saved game names its Status in its own action button, so every card in a row opens the same action line. Compact personal shelves retain their list layout. |
| Search and discovery | `home-search.tsx`, `game-search.tsx`, `catalog-search.tsx`, `discovery-content.tsx`, `tag-shelves.tsx` | GameSearch composes the Cover-led Catalog combobox or embedded list search/actions; preserve Catalog requests, URL filters, retry and empty states. |
| Show a Rating | `rating-stars.tsx` (`RatingStars`) | Read-only stars sized by the surrounding text, with "Rated 4.5 out of 5" as screen-reader text. Stars stay in Ink/Pencil tokens, never a hue. Use the star rating input to choose one. |
| Collections | `library.tsx`, `wishlist.tsx`, `paged-list.tsx`, `collection-loading.tsx` | Reuse filtering, pagination, and collection loading patterns. |
| Add a game to lists | `game-list-picker.tsx` | Compose ListEditorDrawer for selection and inline creation; preserve drafts, authorization, URL continuation and focus restoration. |
| List creation and editing | `list-creation-drawer.tsx` (`ListCreationDrawer`, `ListEditorDrawer`), `list-form.tsx` | Reuse the editor shell for creation, details, game search and sharing; keep drafts on dismissal, associate title errors, and block dismissal while saving. Each Add games opening starts in Search with its URL query retained; menu-launched sharing returns focus to List options. |
| Modal editor viewport | `ui/drawer.tsx`, `use-editor-viewport.ts` and `.editor-drawer` | Drawer positions all sheets inside the visual viewport, including Feedback, when browser toolbars or the keyboard resize it. Shared editor sizing serves Playthrough and list drawers; editors fit their content on every screen up to the visible viewport limit, then scroll; sheets span the viewport and attach to its bottom edge. Keep mobile editors above the software keyboard. |
| Header and navigation | `main-nav.tsx`, `account-menu.tsx`, `skip-link.tsx` | Maintain current-page state and keyboard access to main content. |
| App and browser appearance | `theme-provider.tsx` | Own Light, Dark and System appearance and matching browser theme color; preserve the Dark default and saved choice. |
| Copying and feedback | `copy-button.tsx`, `feedback.tsx`, `feedback-channel.tsx`, `support-link.tsx` | One Feedback drawer serves the account menu, empty Journal and first-save invitation, restoring focus to its origin. Public support uses one contact setting before account setup. |
| Action state cues | `ui/action-feedback.tsx` (`ActionIcon`, `ActionFeedback`) | Compose with Button and the caller's request state. Icons are decorative; keep one stable live region and the visible action label. |
| Completion notifications | `ui/toast.tsx` (`Toaster`, `toast`) | One Base UI host in the root layout. Notify after an editor finishes closing; keep form errors and recovery beside their controls. |
| Username onboarding | `auth-form.tsx`, `onboarding-form.tsx` | Show current Profile visibility and username guidance above Continue; associate the guidance with the username field. Auth form stories cover Private and existing Public guidance. |
| Steam connection | `steam-connection.tsx` | Settings section for connect, disconnect and the link to Steam import. The link appears only when the flag is on and Steam is connected. Selection never expands here. |
| Steam import | `steam-import.tsx` | Text-only review on `/settings/steam`, which 404s with the flag off and returns to Settings without a connection. Three static steps (Read Steam, Review matches, Add to Backlog) follow real request transitions; never show an estimated percentage. Composes Button, Checkbox, Select, PagedList and ActionFeedback. Ready games start selected, existing and removed games are disabled, and selections survive commit failure. A sticky bar keeps the selection count and Add to Backlog in reach; controls above it keep scroll margin so focus stays visible. One live region announces pending/error outcomes; completion replaces the review with a summary, moves focus to its heading and links to Backlog. |
| Selection checkbox | `ui/checkbox.tsx` | Base UI checkbox from the shadcn registry; pair with a visible label and use 44px row targets. |
| Settings actions | `region-form.tsx`, `calendar-feed-form.tsx`, `profile-visibility-form.tsx` | Keep pending and confirmed feedback beside Save or Regenerate URL, retain choices on failure, and prevent duplicate requests. |
| Meaningful motion | `burst-button.tsx`, `odometer.tsx`, `page-transition.tsx` | Use only for the purposes defined below. |

### Cover-led Catalog search
- `GameSearch` owns Catalog requests, debouncing/abort, URL query/filter state, aggregate analytics, shortcuts and restoration. Its default `presentation="catalog"` composes `CatalogSearch`: a bordered Dust panel with a visible search input, game covers and titles, and adjacent Platform/Release year Select controls. Existing Button, Input, Select, GameCover and HomeCoverLink supply shared behavior. The closest previous composition was the Command dialog; search now stays inline with Home rather than taking over the page.
- Results are native links to game pages in the same tab. Click, Enter and Space activate the focused row; Up/Down and Home/End move between results. Enter in the search input opens the first returned match; Space in the input remains a query character. Modifier and middle clicks retain native behavior. No inline Status/Wishlist controls or selected-game details stage appears in standalone search. The game page owns Journal recording.
- The input uses combobox semantics with a nonmodal Base UI Popover dialog containing native result links. Input focus remains in the query while typing; Arrow Down enters results. Escape or Close search dismisses results, preserves the query/filters, and returns focus to the initiating Find a game link or search control. Clicking an adjacent filter leaves focus with that filter. Focused results use a tonal fill and 2px foreground inset outline, with system Highlight in forced colors. No entrance, result stagger or pointer animation runs.
- Filters always sit outside the result popup and narrow only the up-to-50 returned candidates. Preserve unavailable URL choices, Clear filters, empty/failure guidance and retry. Reset query changes clear filters and legacy `all`. Keep all matches in a bounded result scroller with transparent scrollbar rails and a visible overflow cue. Bound popup height to the available viewport, including small screens; long titles, platform names and enlarged text wrap without horizontal overflow.
- `HomeSearch` retains `HomePendingSave` and the provider's post-authentication confirmation/cancel flow. Pending intents remain independent of returned candidates and filters; this is the only standalone modal, using the existing Dialog and editor viewport utility. Search navigation itself never writes to the Journal.
- `presentation="embedded"` retains the list editor's inline Base UI Combobox, action renderer, guidance and input ref. Its selected-game action stage and Back restoration remain necessary to add games to lists. The list drawer owns its viewport. Do not extend the standalone navigation pattern into this separate workflow.
- Find a game links use `/?search=1`; shared valid query URLs, reload and browser Back restore results once. Bare Home visits show the input with results closed. Retained hidden Home instances never claim shortcuts, open another popup or issue background requests. Cmd/Ctrl K belongs to the visible owner and respects unrelated editors and composing input.
- Production states and interactions are in `game-search.stories.tsx`; embedded editor tests stay alongside them. Remove all prototype routes, picker code, alternatives and demo data on promotion. Storybook remains local/CI-only.

### Game details
- Order the page as identity, grouped actions, Journal feedback and Playthroughs, overview and facts, platforms and release dates, then similar games. Visual order and document order stay aligned.
- Use font-relative container breakpoints for the game identity grid so text enlargement restores its stacked layout before the action column becomes too narrow. Below the expanded layout, place an 80px-wide cover beside the complete wrapping title. Actions follow the identity row. Retain the larger desktop cover column and the missing-art fallback.
- Text sits on the ordinary opaque page background. Do not place blurred cover art or an ambient image behind text; its changing colors undermine contrast.
- Keep Journal status, Add playthrough, and Add to list in one wrapping action zone. Add to list reuses ListEditorDrawer as a modal, retaining its own state, authorization, URL continuation, and creation draft across dismissal. Keep its body scrollable and prevent dismissal during mutations.
- Show confirmed Status and any Completion tag in the Journal button itself. Keep pending feedback in its icon and one live output; errors stay beneath the actions. Avoid duplicate status or permanent feedback spacing. Empty and populated Playthroughs share one section before Catalog information; saving the first Playthrough must not relocate it below release dates.
- Disable Journal-status help while removal confirmation is open, so late hover or restored window focus cannot place background help over the modal's controls.
- Removal confirmation applies to the entry, Rating and Playthrough details shown. If another tab changes them, keep the confirmation open with refreshed contents before accepting a new acknowledgement. A stale Playthrough editor keeps its draft and submission identity; saving must not silently recreate removed membership. After an uncertain save, use the current read path to reconcile and avoid promising rollback.
- Loading placeholders reserve the control/status footprint, not a permanent empty history area. Populated history grows in normal flow, so later Catalog content may move when it arrives.
- Available Age rating and Languages details have a visible disclosure cue, meaningful accessible names, and keyboard, pointer, and touch access. Unknown values stay explicit and noninteractive.
- Remaining platforms open in a hover card, not in flow, so a shelf row's covers, metadata and actions never move. Hover, tap, Enter and Space open it and Escape returns focus; focus alone does not, so tabbing across a shelf opens nothing. Fact cards keep their focus-opened details.
- Fact details stay beside their trigger in DOM order. The Languages table's named scroll region is reachable with Tab and shows a visible focus outline, so keyboard users can scroll every language. Escape returns focus to the fact trigger.
- Both missing external scores (Critic score and IGDB user score) share one compact bordered, tonal “Scores unavailable” notice with an information icon and foreground text. If only one is missing, name that score as unavailable. The Community rating card is not part of that notice: it always shows its own state (average, “3 Ratings so far”, “No Ratings yet” or “Community rating unavailable”).
- The rating control follows the Journal actions, before Playthroughs: the full StarRating for Played or Playing, a read-only Rating with Clear rating and the reason for Backlog or Wishlist, nothing without a Rating, and for guests the one Sign in that also covers rating. Rating feedback is static: no selection animation or confetti. Unknown age and language values use compact labeled metadata; reserve large value cards for known facts.

### Buttons
- **Shape:** 10px radius, 32px minimum height and 10px side padding. `lg` is 36px. Icon-only buttons are square (`icon` is 32px).
- **Primary:** a Graphite or Bone fill. Use at most one per view.
- **Outline:** a hairline border on Paper; the common secondary action.
- **Ghost:** no fill until hover. Use for toolbars and menu triggers.
- **Destructive:** Ember text on a 10% Ember tint. It's never a solid red fill.
- **States:** hover darkens the fill to 80% or adds a Dust fill. Enabled presses scale to exactly 0.96 over 150ms with ease-out, only under no preference for reduced motion. Use the shared `press="static"` variant for anchored triggers where scaling distracts. Native, Base UI, and ARIA-disabled controls never scale or activate. Controls supplying their own press feedback suppress the browser tap highlight. Focus shows the standard 3px ring at 50% opacity. Disabled is 50% opacity with no pointer events.
- **Action feedback:** reuse `ActionIcon` for idle → pending → confirmed/error cues, with request state owned by the caller. Keep the label stable while pending, set `aria-busy`, and prevent repeated submissions. `ActionFeedback` supplies a check and brief text beside a control; it does not announce by itself. Keep a single stable output/live region in the owning flow. Icons complement visible labels, never replace them. List action names retain their visible phrase before game/list context.
- **Authentication notices:** pass page confirmations such as a completed password reset through `AuthForm`'s `notice` prop. They share its stable status region and leave the form available; pending submission feedback takes precedence. Reserve submitted `message` results for confirmations that replace the form.
- **Icon cues:** use Lucide consistently: ListPlus for Add to list, Pencil for editing, Share2 for sharing, RotateCw for retry/regeneration, Download for exports, CalendarPlus for subscribing, Trash2 for removal, and ChevronDown on menu triggers. Decorative icons use `aria-hidden`. Status and Completion tag meanings remain the terms in GLOSSARY.md; Played is not an assertion that a game was completed.

### Completion notifications
- `ui/toast.tsx` adapts the shadcn Base UI Toast registry to the existing palette, radius and motion. The installed Base UI dependency provides timers, announcements, keyboard access, focus restoration and dismissal. Every notification remains expanded, with its text, recovery action and 44px dismiss control available. Swipe dismissal is omitted; it supplies no extra task capability here.
- Mount `Toaster` once in the app root. It uses a polite Notifications region and never takes focus when a notification arrives. Notifications sit below active modal layers so an earlier completion cannot obscure the next editor's controls. Let drawer dismissal restore focus before publishing completion. Playthrough save/update/delete and list-details saves notify after the closing transition; list removal/deletion also confirms completion when its original control disappears.
- Success uses a monochrome check and a six-second timeout. Errors and notifications containing recovery actions use `timeout: 0` and remain until dismissed. Do not put the only recovery path in a disappearing notification. Field errors, retained drafts, stale-save recovery and manual-copy instructions stay in context.
- Reuse `Button` rather than creating a second button primitive. `ActionIcon` extracts CopyButton's existing visual state transition; CopyButton retains clipboard-specific state, analytics and recovery. Notifications have a distinct responsibility and use the existing Base UI library instead of extending the feedback editor or adding a notification dependency.

### Inputs / Fields
- **Style:** a hairline stroke, transparent fill (`input/30` in dark mode), 10px radius and 32px height. The search field wraps its input and controls in one focus-within container.
- **Focus:** the border changes to Ring and the 3px ring appears.
- **Error:** an Ember border and Ember ring at 20%, driven by `aria-invalid`. Messages go in `Field` primitives so they stay programmatically associated with the input.

### Cards / Containers
- **Card:** a 10px radius and hairline border with 16px padding. No shadow.
- **Notice:** a hairline border on Dust at 40%, with 12–16px padding. It enters with the `.enter` class.
- **Wishlist freshness:** `Wishlist` reuses its existing tonal notice composition for stale or failed release checks. Keep known dates and unannounced groups visible; the note explains that dates may be old and checks resume automatically. Empty Wishlists omit the note. `wishlist.stories.tsx` covers current, unavailable, empty, and Status-action states.
- **Empty state:** a dashed border with 16px padding (32px from `sm`), left-aligned. It has one sentence and one action.
- **List collection:** align the page with the 72rem frame. Group the heading and explanation with 8px spacing and place “Create a list” beside them on wider screens. Cards are one link with cover previews, a wrapping title, and quiet 14px metadata; changing counts use tabular figures. Empty cards retain the preview area with “No games added yet”.
- **List editor:** games lead the page. Group title, visibility, game count and update date closely. Keep Add games at the top as the primary action, with Edit details and List options as secondary controls. Add games opens the shared editor drawer with focused Catalog search; keep it open for multiple additions. Keep long descriptions behind “About this list” so they cannot push Add games down the page. Details and sharing open on demand. Keep the Add games trigger enabled during stale-save recovery so dismissal can return focus; block mutations inside the drawer instead. Show refresh actions only beside errors or stale-save recovery. Removal uses the destructive button treatment; list deletion remains confirmed from List options.
- **Creating from a game:** the action explicitly says “Create list and add [game]”. Save the list and initial entry atomically, preserve the submission key for retries, then collapse creation inside the list-picker drawer and announce the addition. Public visibility says that the List is visible to anyone and listed when the profile is Public.
- **List creation drawer:** reuse the Playthrough editor's bottom-sheet shape and viewport handling. Keep the form in a 36rem column with optional description guidance. Closing keeps the draft; successful creation opens the new list to add games. Editor entry is 220ms and exit is 140ms, with the shared reduced-motion override.
- **Form drawers:** on desktop and mobile, editors grow with their content rather than reserving a fixed height. On desktop, use the visible viewport minus 32px as the maximum, without a 720px cap; longer forms retain their existing contained scrolling. Vertical drawers span the full viewport width and sit flush with the bottom on desktop and mobile, with rounded top corners only. Keep the centered 36rem form column for readable fields. Feedback uses the shared Drawer's larger desktop height allowance. Mobile uses its existing keyboard-aware viewport limit as a maximum rather than a fixed height. The modal backdrop uses 60% black to suppress distracting page content while preserving swipe and dismissal behavior.

### Account security feedback

- DeleteAccountForm extends the existing Settings composition with verified-email code entry for Google-only accounts. Password accounts retain Current password. Reuse Button, Input and Label; AuthForm is the closest general form but serves sign-in rather than this embedded destructive flow.
- Each deletion/sign-out flow owns one stable output for confirming, sending, cancelling, deleting or signing out. Keep action labels unchanged while Button supplies decorative loading. The email code cannot delete; typed DELETE is the final step. Email code entry receives focus after sending, typed confirmation after verification, and cancellation restores the password or send-code control.
- Stories cover password retry, code entry/cancellation/delivery retry, all pending phases and typed confirmation. No new motion or generic primitive is introduced.

### Loading feedback
- Use static `Skeleton` shapes for predictable initial content: Home and personal shelves, list collections/details, public profiles, Stats, Settings and account navigation. `content-loading.tsx` composes the primitive using the cover-row pattern from `CollectionLoading`; it is a distinct product responsibility rather than another mode on the Library/Wishlist component. Keep shapes decorative and provide one readable loading output per boundary. Never show invented counts or interactive placeholder controls.
- Preserve existing content during background refresh, local filtering and pagination. Use the Compass beside the existing progress text for Catalog search, Journal checks, saves, deletes, moves, copying and retries. Skeletons describe future content; the spinner indicates ongoing work.
- `ui/spinner.tsx` adapts [loading.dev’s Compass](https://loading.dev/spinners/compass) under MIT (notice in `docs/licenses/loading-dev.md`). The shadcn Base UI Spinner was considered; its Lucide spinner does not match the requested Compass. This local SVG uses currentColor and four ticks rotating 90° every 500ms with the source’s ease-in-out curve. This repeating state indicator is the intentional exception to the sub-300ms transition budget. It animates only transform and becomes static under reduced motion.
- Progress labels beside the Compass use the existing `shimmer` utility from `shadcn/tailwind.css`: a 2s linear sweep, applied only to a text span while work is pending. Keep the Compass outside the shimmer span, retain one copy of the text and the existing live region, and remove shimmer on completion or failure. Status text uses Pencil as its base and Ink/Chalk as the moving highlight, making the sweep visible in both themes while retaining readable text throughout. Start the band 500ms into the 2s cycle so short requests reveal it immediately. Button labels keep their inherited color and use a contrasting, bounded highlight for their surface. Reduced motion and forced colors restore stationary, solid text. This small text-only background-position effect is an intentional use of the requested upstream animation; skeletons remain static. No new component or animation dependency is needed.
- `Button loading` extends the existing action control: retain the label inside a shimmer span, prepend the decorative Compass, set `aria-busy`, and block activation. Preserve explicit disabled/focusable behavior and use the flow’s existing output for announcements; the SVG never creates another live region. Controls that already compose `ActionIcon` keep that composition; its pending layer reuses Compass and `ActionFeedback` shimmers its pending label. Anchored Journal triggers preserve their state layers, focus and positioning.
- Storybook: **UI/Spinner**, **UI/Button → Loading / Pending then retry**, **Product/Loading content**, and the existing search, Home Journal and editor stories demonstrate loading, resolution and failure/retry. The catalog remains local/CI-only.

### Profile visibility

- `ProfileVisibilitySection` (in `profile-visibility-form.tsx`) renders the heading and privacy guidance in the Settings shell outside the form's Suspense boundary. `ProfileVisibilityForm` keeps a short fieldset legend and associates that guidance with `aria-describedby`; compose both in app and catalog callers. `ProfileVisibilityLoading` (in `content-loading.tsx`) reserves the radio cards and Save control without repeating the static heading or guidance. Storybook includes the loading shell.
- `ProfileVisibilityForm` composes the existing RegionForm radio-card and Save feedback pattern for a distinct setting. It retains the selected choice on failure, blocks duplicate saves, keeps Save focusable while pending, and announces confirmed success beside Save. No new motion is needed. Storybook: **Product/Profile visibility**, including Private, Public, pending and error/retry.
- Explain the public field boundary and independent List visibility before publishing. New accounts start Private; existing accounts stay Public. Onboarding shows the current value above Continue. Private owner profiles show “Only you can see this” and a Settings link; private profiles are a generic 404 to everyone else, including shared images and metadata. Public List pages omit links to Private profiles.

### Privacy information

- `/privacy` is the authoritative notice. Signup composes its link through AuthForm’s existing children slot; Settings uses its existing bordered section pattern, and the root footer includes the same destination. CalendarFeedForm keeps secrecy and regeneration guidance beside the URL; export explains its Journal scope beside Download JSON. No new control or motion is needed.
- The notice follows the focused 36rem reading column, semantic headings and paragraph spacing. Keep provider/retention/contact claims tied to repository evidence and the owner checklist in `docs/security-operations.md`.

### Navigation
- **Style:** Pencil text-sm links with an underline on hover. The current page uses Ink, weight 500 and a 2px underline, driven by `aria-current="page"`.
- **Targets:** at least 44px. A skip link comes first in tab order.

### Floating layers (menus, selects, tooltips, hover cards, dialogs)
- Use the Base UI primitives in `src/components/ui/` and don't hand-roll these.
- Popovers transition opacity and scale from their trigger with `origin-(--transform-origin)` using Base UI starting/ending states. Interactive layers use retargetable transitions, never open/close keyframes; Base UI retains exit mounting and focus/dismissal behavior. Reduced motion keeps opacity alone. Trigger-aligned selects keep opacity alone to preserve alignment. Dialogs stay centered.
- They use the floating-layer shadow plus a 1px solid transparent border so forced colors retains a visible edge, with 4–10px internal padding. Apply overscroll containment to the actual scroller: menu/submenu popups, select popup and list, Languages table, and removal confirmation. Preserve the Playthrough drawer’s existing containment and nested-select Escape behavior.

### Game cover (signature)
- Use `GameCover`, which applies the 264:374 aspect ratio, `object-cover` and lazy loading.
- The cover is decorative (`alt=""`); the adjacent title names the link.
- It uses the cover-on-shelf shadow and 10px radius in grids. Compact rows use 48px-wide thumbnails with a smaller radius and no shadow.
- Content images (game covers, public-profile photos, and account-avatar photos) use a 1px solid outline inset by 1px, following their radius without changing size. `--image-outline` is `oklch(0 0 0 / 0.1)` in Light and `oklch(1 0 0 / 0.1)` in Dark. Skip transparent logos, rating-board art, and image fallbacks.
- Missing art shows a Dust tile with an ImageOff icon and "No cover art". Never leave an empty box.
- `TiltCover` adds pointer tilt and glare, and scales to 0.96 when pressed. Both are disabled under reduced motion.

### Delight components (signature)
- **BurstButton:** confetti when a toggle switches on, never when it switches off. It renders nothing under reduced motion.
- **Odometer:** rolling digits for counts that change. It provides a screen-reader-only text value with `aria-hidden` digits.
- These use 900ms motion. Add new delight only for moments that matter to the player; game-detail text has no ambient image backdrop.

### Motion
Motion is implemented in `globals.css` and the components; `.impeccable/design.json` records the reference values.
- **Curve:** `cubic-bezier(0.22, 1, 0.36, 1)`, a strong ease-out, for entering, disclosure, routes and covers. Use plain `ease-out` for exits.
- **Durations:** exits 140ms, disclosure and inserted content 200ms, routes and cover entry 220ms, cover morph 280ms.
- **Popup feedback:** 200ms entering with the existing ease-out curve, 140ms exiting with ease-out; tooltips use 125ms and skip transitions for instant handoff. Reduced motion retains only opacity.
- **Action/copy feedback:** `ActionIcon` declares each layer’s opacity in its markup so inactive icons stay hidden independently of the motion stylesheet, keeps state layers in one grid cell, and cross-fades in both directions for exactly 300ms with `cubic-bezier(0.2, 0, 0, 1)`, scale 0.25 ↔ 1 and blur 4px ↔ 0. Reduced motion uses opacity alone. The default icon starts settled. CopyButton reuses it and preserves Copying/Copied, disablement, the two-second reset, success-only analytics, and manual-copy recovery.
- **Notifications:** interruptible opacity/4px-rise transitions use 200ms with `cubic-bezier(0.22, 1, 0.36, 1)` entering and 140ms ease-out exiting. Reduced motion keeps opacity alone. Do not animate notification height or stagger routine actions.
- **Theme:** the existing provider suppresses transitions through its theme style flush for explicit choices and System appearance updates, then promptly restores them. Preserve the Dark default and persisted selection.
- **Journal pending:** the Compass animates only with no reduced-motion preference; visible “Saving…” beside the button and a single live output provide stationary progress feedback. Keep the action’s static label. Home Status saves swap the acted-on button's icon and retain the scoped Journal updates announcement; persistent current Status stays visible without inserting a duplicate confirmation paragraph.
- **Tag selection:** press feedback uses the same 0.96 / 150ms ease-out scale contract; name `scale` in transition properties. Selection and shelf replacement are immediate, without routine cover-entry sequences. Gate hover feedback to hover-capable fine pointers.
- **Route changes** use view transitions: the old page fades out and the new one fades up 6px. Personal collection links in Home, Library, and Wishlist use per-link prefetching (`prefetch={true}`) so the cached hero is ready for the same navigation snapshot. Direct visits and unfinished prefetches retain the route-local game skeleton.
- **Inserted content** uses `.enter`: CSS transitions with `@starting-style` and a 4px rise, so it can be interrupted.
- Every animation has a `prefers-reduced-motion: reduce` branch that removes movement and keeps opacity only where it helps.

## UX and copy

- Use the terms in `GLOSSARY.md`. Name destinations and Status choices consistently; use sentence case for other labels. Prefer specific verbs: “Add to Journal”, “Add playthrough”, “Remove from Journal”.
- A Playthrough finish date and a game's Status are independent. Explain that distinction where it affects a choice. A new release never silently moves a Wishlist game to Backlog or Playing.
- Keep the user's task and entered values through sign-in, validation, or a failed save. Show pending feedback immediately, prevent duplicate submission, and announce confirmed success once. A failed save needs a retry action and a useful explanation.
- Distinguish an empty Journal, no matching search results, loading content, and a failed request. Give an empty state a clear next action; give a failure a recovery action. Keep previously loaded content available when possible.
- Explain what will be removed before destructive actions and retain the existing confirmation or undo behavior. State when notes are private. Do not imply that saving a game means owning or buying it.
- Truncate secondary metadata only when the full value remains available. Let titles, errors, notes, and button labels wrap; test long titles, missing cover art, non-Latin text, and large counts.

### Private feedback

- Keep the account-menu entry permanent and add “Something confusing or missing?” as a quiet empty-Journal action. The first successful game save may show an inline, nonmodal invitation; its opportunity is consumed atomically once per account in the first insertion’s transaction, across devices. Only that save request can return the invitation; later Status changes, retries and deletion/re-addition never recover an abandoned opportunity. Dismissal and closing the editor leave permanent entries available.
- Reuse Feedback rather than introducing a second form. Category guidance describes needs, expected behavior, and usability friction without adding required fields. Keep the visible Message label, draft recovery, 2,000-character limit, single status announcement and originating-control focus return.
- Explain the team/processors audience, username, sanitized opening page and account reply address before submission. Do not include passwords or private notes. Do not promise response times or unverified retention. The authoritative privacy notice belongs to issue #130; operational dependencies and reconciliation are in `docs/feedback-operations.md`.
- `SupportLink` is a native email link resolved from `SUPPORT_HREF` in `src/config/site.ts`. It adds no page, credential or account context and appears in AuthForm (including onboarding), invalid reset recovery and the footer. The private notification recipient remains server-only.

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

### Account security controls

- Settings extends `DeleteAccountForm` with fresh password or Google authentication before typed DELETE. Proofs last at most five minutes; cancellation returns to authentication and restores focus. The final confirmation input receives focus after password verification. Errors stay beside the flow; secrets never enter analytics.
- `DeleteAccountForm` reuses Button, Input and Label rather than adding another authentication primitive. `AuthForm` was considered, but its standalone page heading and success replacement do not fit the embedded Settings confirmation sequence. `SignOutAllForm` composes the same controls for a distinct session action, with pending feedback and inline retry.
- Storybook: **Product/Delete account** covers password failure/retry, pending, Google cancellation and typed confirmation/cancellation. **Product/Sign out all devices** covers failure/retry and pending. No new motion is introduced.

### Year in Review

- **Product/Year in Review** is a distinct seasonal composition; Stats charts were considered but represent different measurements. It reuses GameCover, Button, Checkbox and Label, with the existing Stats loading pattern. The whole page is set in Geist Mono at weights 400 and 500.
- The page is one ruled 4:5 sheet with a rail beside it on desktop and below it on phones. Document order is the page title, the sheet, the keepsake controls, the six latest games logged, then how the numbers are counted. The sheet is a four-by-five grid of cells separated by 1px Ink rules: the year, the logo, Games logged as the hero, up to three latest covers, Games logged by month, Games played, Hours recorded, up to five played covers and Top platform. It follows the Keepsake Exception; covers are the only other color.
- Sheet type is sized in container units so the sheet scales as one object, with a 10px floor for labels. Counts shrink to fit their cell, so large numbers never clip. Text-only enlargement does not resize sheet text; browser zoom does. Every count on the sheet is also defined in plain text in the rail.
- Sheet covers are links named by a hidden title; the rail list shows the visible titles. Empty cells say what is missing instead of leaving a blank.
- The 1080 × 1350 PNG matches the sheet’s ruled layout, Keepsake colors, Geist Mono, counts, monthly chart and cover selections. ImageResponse uses fixed cells because it does not support CSS grid. Optional username appears in the PNG header only; the exact image is always previewed before download.
- The sheet enters once as a single object: 240ms opacity and an 8px rise with the existing cover easing. It never gates actions and does not replay when toggling username or retrying. Reduced motion removes the entrance. Fan covers lift 6px on hover for fine pointers only; no animation dependency is added.
- Preparing the PNG is an explicit action. The exact returned image is previewed before download. Username is off by default; changing it clears the preview. Preparation/download have duplicate guards, feedback and retry. The server rechecks access before a prepared image can be downloaded.

### Year in Review invitation

- Home shows ReviewInvitation only for a signed-in player with the review flag enabled. It reuses Button and Link in a ruled bento: an Ink year tile, a Paper copy tile, and a separate action row with a Marker View cell, all in Geist Mono. It follows the Keepsake Exception; the existing plain ReviewInvitation link was extended into a product composition. It is independent of Stats navigation and does not prevent opening the review after dismissal.
- A client mount records a real review visit, so prefetching does not mark it opened. After opening, View remains alongside Dismiss (the current sign-in across tabs) and Don’t show again (this review year, across all devices). Nullable year fields on the user and session retain these choices without browser storage; next year’s invitation compares a new campaign year.
- Hiding waits for a confirmed save; failure preserves the banner with a polite retry message. Dismissing returns focus to the Home heading. No new motion is introduced.
