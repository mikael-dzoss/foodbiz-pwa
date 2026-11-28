<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FoodBiz PWA — Agent Contract

Next.js 16.4 App Router PWA (installable customer storefront + installable manager dashboard) on Supabase, TypeScript strict, Tailwind v4, zod v4, Vitest, Vercel. Details: [architecture.md#stack](docs/architecture.md#stack).

## Project Layout

```text
/src
├── app/          → Routes, layouts, manifests ([locale]/manifest.webmanifest, manage/manifest.webmanifest), globals.css (theme tokens)
├── proxy.ts      → Request proxy (session refresh via lib/supabase/proxy)
├── config/       → Env parsing (zod) and app metadata
├── lib/repositories/ → Mock and Supabase adapters behind `domain/repositories` interfaces
├── lib/supabase/ → client.ts (browser), server.ts (RSC/actions), proxy.ts (session refresh), admin.ts, realtime.ts, storage.ts
├── domain/       → Models, types, KPI logic, zod schemas (framework-free)
├── features/     → Feature modules: storefront, dashboard, orders, products, expenses, customers, manager, settings, auth
└── components/   → Shared UI primitives (design system)
/supabase/migrations → SQL migrations (schema + RLS policies)
/public               → Static assets and icons (no service worker yet)
```

Keep to this separation.

## Rules

1. **Read before write.** Read files before editing; never guess code. Read the matching Next.js guide (see [Where to look](#where-to-look)) before using an API.
2. **Types.** Strict TypeScript: no `any`, no `const enum`, no unconstrained generics. Named imports, `@/` alias for `src/`. Derive types from zod schemas in `src/domain/` (`z.infer`).
3. **Layers.** Presentation (JSX/Tailwind), data access (`src/lib/supabase/*`, Server Actions) and domain (types, zod, pure logic; no React/Next/Supabase imports) stay separate. Keep `layout.tsx` and `proxy.ts` thin. Keep seed/mock data swappable for Supabase queries.
4. **Security non-negotiables.** Every Server Action parses input with zod and re-checks auth. Supabase only via `src/lib/supabase/*`, one server client per request. The service-role key is never `NEXT_PUBLIC_*`, never client-side, never committed. Every table has RLS; schema changes only in `supabase/migrations/`. Env is parsed in `src/config/env.ts`; update `.env.example` when adding variables.
5. **Immutability.** Never mutate state/props in place (spread, `map`, `filter`, `toSorted`).
6. **Done = `npm run gate` green locally, then CI** ([CONTRIBUTING.md#validation-gate](docs/CONTRIBUTING.md#validation-gate)). Never lower coverage floors, add coverage excludes or skip tests to pass.
7. **Git.** Never commit or push to `develop`, `staging` or `main`; work on a `feature/`, `bug/` or `utils/` branch and open the PR against `develop` (or the preceding stack branch). Agents merge their own PRs into `develop` once checks pass; promotion to `staging`/`main` is the owner's. Create issues only via the `issue-logger` skill. Full workflow: the `ship` skill.

## Where to look

Read only the section you need.

- **Pick up, implement, stack, review and merge work** ("next N items", "implement #N"): `ship` skill ([SKILL.md](.agents/skills/ship/SKILL.md))
- **Break a need into an epic/stories:** `planning-and-task-breakdown` skill, then `issue-logger`
- **Edit `src/`** (UI, routes, actions): [web.instructions.md](.agents/rules/web.instructions.md) (auto-applied)
- **SQL, migrations, RLS:** [backend.instructions.md](.agents/rules/backend.instructions.md) (auto-applied on `supabase/**`)
- **Auth, sessions, secrets, headers, CSP:** [security.instructions.md](.agents/rules/security.instructions.md)
- **Explore or explain code:** [graphify.instructions.md](.agents/rules/graphify.instructions.md) (always on)
- **Build a screen or component / Stitch:** [design.instructions.md](.agents/rules/design.instructions.md) (Stitch canvas-first flow), [DESIGN_SYSTEM.md](docs/design/DESIGN_SYSTEM.md) (§2 tokens, §7 components), [SCREENS.md](docs/design/SCREENS.md#screens)
- **MCP servers (Stitch, Vercel):** Copilot and Claude Code share [`.mcp.json`](.mcp.json) (`chat.mcp.workspaceRootConfig.enabled`); Antigravity uses `~/.gemini/config/mcp_config.json` (install/reinstall via `node scripts/setup-agy-mcp.mjs`). Stitch uses the local stdio bridge [`scripts/stitch-mcp-bridge.mjs`](scripts/stitch-mcp-bridge.mjs) (180s timeout); keys come from `STITCH_API_KEY` / `VERCEL_API_TOKEN`.
- **Business rules, domain model:** [FUNCTIONAL_SPECIFICATION.md#5-core-business-rules](docs/FUNCTIONAL_SPECIFICATION.md#5-core-business-rules), [#6-domain-model](docs/FUNCTIONAL_SPECIFICATION.md#6-domain-model)
- **Supabase clients, session refresh:** [architecture.md#supabase-clients](docs/architecture.md#supabase-clients)
- **Port legacy Expo behaviour:** [LEGACY_EXPO_REFERENCE.md](docs/LEGACY_EXPO_REFERENCE.md)
- **Next.js caching, auth, forms, CSP, PWA, proxy:** `node_modules/next/dist/docs/01-app/02-guides/` → `authentication-with-cache-components.md`, `forms.md`, `data-security.md`, `content-security-policy.md`, `progressive-web-apps.md`; `03-api-reference/03-file-conventions/proxy.md`
