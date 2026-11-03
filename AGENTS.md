# AGENTS.md

## Development

- `npx vercel@latest env pull .env.local` pulls `DATABASE_URL` (Neon, via Vercel Marketplace).
- `pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test` (Vitest) · `pnpm test:e2e` (Playwright).
- Schema changes: edit `src/db/schema.ts`, then `pnpm db:generate`. Production deploys apply pending migrations during `pnpm build` (only when `VERCEL_ENV=production`); old code serves until the deploy is live, so migrations must stay backward compatible (add, don't drop or rename in the same deploy). To migrate by hand: `pnpm db:migrate` (needs `DATABASE_URL` in the shell env).
- Module tests use `createTestDb()` (in-memory PGlite with all migrations applied); never hit Neon from tests.

## Agent skills

### Design and accessibility

- Before changing UI, interaction, or product copy, read `DESIGN.md` and use the vocabulary in `GLOSSARY.md`.
- Before adding or extending UI components, read `docs/ui-catalog.md` and search the Storybook catalog (`pnpm storybook`). With Storybook MCP connected, use `docs-list` and `docs-show`; otherwise read the colocated `*.stories.tsx` files. Check the implementation and callers too: a component without a story may already exist.
- Reuse a component when its semantics fit; extend it when the capability belongs to its existing purpose; compose or create a component when the responsibility is distinct. Explain the choice and the closest existing component considered in the change description.
- If no local component fits, check the shadcn Base UI registry through MCP (or CLI if unavailable). Keep generic primitives in `ui/` and product compositions in `src/components/`. Add or update colocated stories and the `DESIGN.md` index for reusable components; include meaningful states and interaction tests.
- Keep Storybook local/CI-only: app code must import production components directly, never stories or catalog dependencies. Keep catalog output outside `public/` and web deployment scripts. Preserve the production exclusions documented in `docs/ui-catalog.md`.
- Use `emil-design-eng` for interaction polish, `animate` for new motion, `review-animations` for motion review, and `impeccable` for broader UI audits. These skills guide implementation; `DESIGN.md` records this app's choices.
- For UI changes, run `pnpm test:storybook`, `pnpm build-storybook`, `pnpm test:e2e e2e/accessibility.spec.ts`, and relevant interaction tests. Complete the manual checks in `DESIGN.md` for the affected flow; report checks you could not perform.

### Issue tracker

Issues live in GitHub Issues (`guillermo-rebolledo/vgame-journal`), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
