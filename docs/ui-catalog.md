# UI component catalog

Storybook is the interactive catalog of components shipped in shelve.games. Examples import the real implementations, share the app's Tailwind tokens and Geist fonts, and use local callbacks instead of a database or authenticated session.

Run `pnpm storybook` and open `http://127.0.0.1:6006`. Use the sidebar search to find a component, **Docs** to inspect its purpose, props, and source examples, **Controls** to change props, and the theme toolbar to switch between light and dark. The viewport toolbar helps inspect narrow layouts. Accessibility results and interaction steps are available alongside each story.

## Find, extend, or create

1. Search the catalog by the task and by the control type. `UI` contains shared primitives; `Product` contains app-specific compositions. Read the component description, examples, implementation, and existing callers.
2. Reuse the component when its semantics and behavior fit. Compose existing primitives for a product-specific arrangement.
3. Extend an existing component when the new capability belongs to the same purpose and preserves current callers. Add a focused prop or variant and a story showing the additional behavior.
4. Create a new component when its semantics or responsibilities are distinct, or an extension would introduce unrelated modes and flags. Check the shadcn Base UI registry first. Explain the choice in the change description, including the closest existing component considered.

A missing story does not mean a component is missing: search `src/components/` and its call sites before creating one. The initial catalog covers every module in `src/components/ui/` plus GameCover, JournalStatus, PlaythroughForm, and Odometer. Cover-led Catalog navigation, filters, and embedded list search states are in `game-search.stories.tsx`; direct and compact Status actions are in `home-journal.stories.tsx`. Authentication and server-side persistence remain covered by the existing unit and E2E suites.

`DESIGN.md` owns visual direction and UX/accessibility requirements. `GLOSSARY.md` owns product vocabulary. Stories demonstrate these decisions; they do not define a separate theme or component implementation.

## Add or update a component

Colocate `<component>.stories.tsx` with the implementation. Use a `UI/Name` or `Product/Name` title, set `component`, and describe when to reuse it, its constraints, and any related higher-level component. Use `subcomponents` for compound APIs. Autodocs, Controls, source examples, and the agent manifest are generated from these stories.

Document the default state and meaningful variants: disabled, missing data, long content, pending, empty, error, and recovery where applicable. Keep fixtures deterministic. Pass local callback spies (`fn` from `storybook/test`) rather than importing server actions. Use `parameters.nextjs.navigation` when a component needs a specific route. The framework supplies App Router stubs; the preview supplies TooltipProvider and mocked analytics. Add other providers only when a component requires them.

Add a `play` function for meaningful behavior, such as keyboard activation, selection, focus restoration, error recovery, or keeping drafts after a failed save. Use role/label queries. Query `canvasElement.ownerDocument.body` for portaled menus and drawers. Keep the state after the interaction accessible: the automated accessibility check also runs after `play`.

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: { children: "Save", onClick: fn() },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Save: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Save" }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
```

## Test and review

- `pnpm test:storybook`: render every story in Chromium, run its interaction assertions, and fail on detected WCAG A/AA accessibility violations. Storybook does not need to be running.
- `pnpm test:storybook --watch`: watch component stories while working. The Storybook sidebar test widget also runs these tests.
- `pnpm build-storybook`: build the browsable static catalog and JSON manifests into `storybook-static/`.
- `pnpm test`: run the existing unit tests. `pnpm test:e2e` continues to test complete app workflows.

CI builds the catalog and runs the component tests. The static build is available as a workflow artifact; downloading it does not publish the catalog publicly. Review controls, keyboard behavior, both themes, narrow widths, and reduced motion. Representative light-theme stories are included in the test suite; use the toolbar to inspect every changed story in both themes. Automated accessibility checks do not replace the manual checklist in `DESIGN.md`. Screenshot comparison against approved baselines is not configured.

Keep the Storybook packages on the same version when upgrading. Upgrade Vitest and `@vitest/browser-playwright` together; the browser provider expects a matching Vitest version.

## Production boundary

Storybook runs locally and in CI; the catalog is not a web deployment. `pnpm build` builds only Next.js. `vercel.json` selects that command and the `.next` output, while `.vercelignore` excludes catalog configuration, stories, documentation, and static output from deployment uploads. Keep Storybook and its font/test packages in `devDependencies`, and keep catalog assets outside `public/`.

Next.js uses `tsconfig.build.json` to check app sources without including stories or catalog tooling. `pnpm typecheck` still checks the complete development project, including Storybook.

The app's Tailwind entry scans `src/` and explicitly excludes `*.stories.tsx` and `*.stories.ts`, so story-only utility classes do not enlarge the web CSS. `.storybook/preview.css` separately generates catalog utilities using the shared app theme as a reference. It is imported only by the Storybook preview. Biome also rejects Storybook, catalog font, and story imports from production source files.

The preview mounts the production `Toaster` once so product stories exercise the same completion notifications as the app. `UI/Action feedback` shows decorative state layers; `UI/Button/AsyncFeedback` exercises keyboard submission, duplicate prevention and retry. `UI/Toast` covers success, persistent recovery, dismissal and long content. Product stories for authentication, feedback, Release region, Profile visibility, Calendar feed and Game recording cover the corresponding request outcomes with local callbacks. These catalog providers and callbacks stay outside production imports.

## Agent access

The Storybook MCP addon is enabled at `http://127.0.0.1:6006/mcp` while `pnpm storybook` runs. Connect that HTTP endpoint in your agent client's MCP settings. This repository does not silently alter personal agent settings. Storybook's MCP/manifest APIs are currently in preview.

When connected, query `docs-list` and `docs-show` before implementing UI. Use `stories-find-by-component` to find affected examples and `test-run` to verify them. If MCP is not connected, read the colocated stories and source directly; you can also inspect `http://127.0.0.1:6006/manifests/components.json` or `storybook-static/manifests/components.json` after a build. `index.json` lists the story IDs and source files.

Official references: [Next.js/Vite integration](https://storybook.js.org/docs/get-started/frameworks/nextjs-vite), [component testing](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon), [accessibility checks](https://storybook.js.org/docs/writing-tests/accessibility-testing), and [MCP setup](https://storybook.js.org/docs/ai/mcp/overview).
