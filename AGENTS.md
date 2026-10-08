<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FoodBiz PWA — Agent Contract

> Next.js 16 App Router PWA (storefront + manager dashboard) on Supabase. Successor to the legacy Expo app.
> Before using any Next.js API, read the matching guide in `node_modules/next/dist/docs/01-app/` (e.g. `02-guides/progressive-web-apps.md`, `02-guides/forms.md`, `02-guides/data-security.md`, `02-guides/content-security-policy.md`, `02-guides/authentication-with-cache-components.md`, `03-api-reference/03-file-conventions/proxy.md`).
> Architecture: [`docs/architecture.md`](docs/architecture.md) · Contributing: [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) · Migration plan: [`migration_plan.md`](migration_plan.md)

---

## Stack

| Layer      | Technology                                         | Notes                                                            |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| Language   | TypeScript 5 (strict)                              | No `any`, no `const enum`                                        |
| Framework  | Next.js 16.4 (App Router), React 19.3              | `cacheComponents: true`; `src/proxy.ts` replaces `middleware.ts` |
| Styling    | Tailwind CSS v4                                    | Tokens in `src/app/globals.css` `@theme`; Prettier sorts classes |
| Backend    | Supabase (Postgres, Auth, Storage, RLS)            | `@supabase/ssr` + `@supabase/supabase-js`                        |
| Validation | `zod` v4                                           | Schemas in `src/domain/`; reused by Server Actions and forms     |
| Mutations  | Server Actions                                     | Validate with zod, re-check auth in every action                 |
| Testing    | `vitest` + Testing Library (jsdom)                 | `npm run test`                                                   |
| PWA        | `src/app/manifest.ts`, service worker in `public/` | Installable manager experience                                   |
| Deploy     | Vercel                                             | Preview per PR                                                   |

## Project Layout

```text
/src
├── app/          → Routes, layouts, manifest.ts, globals.css (theme tokens)
├── proxy.ts      → Request proxy (session refresh via lib/supabase/proxy)
├── config/       → Env parsing (zod) and app metadata
├── lib/supabase/ → client.ts (browser), server.ts (RSC/actions), proxy.ts (session refresh)
├── domain/       → Models, types, KPI logic, zod schemas (framework-free)
├── features/     → Feature modules: storefront, dashboard, orders, products, expenses, analytics, auth
└── components/   → Shared UI primitives (design system)
/supabase/migrations → SQL migrations (schema + RLS policies)
/public               → Static assets, icons, service worker
```

Create `domain/`, `features/`, `components/` as needed; keep to this separation.

## Rules

### 1. Read-Before-Write (mandatory)

Read existing files before editing. Never guess code. Read the bundled Next.js docs before asserting an API.

### 2. Type Safety

- Strict TypeScript. No `any`, no unconstrained generics, standard `enum` only.
- Named imports; use the `@/` alias for `src/`.
- Derive types from zod schemas (`z.infer`) instead of duplicating them.

### 3. Styling — Tailwind + Tokens

- Use Tailwind utility classes. Colors, spacing, radii, fonts come from tokens declared in `@theme` in `src/app/globals.css`.
- No `style={{}}` props, no hardcoded hex/px values in components (arbitrary values like `w-[137px]` are a smell — add a token).
- Mobile-first: base classes target phones, add `sm:`/`md:`/`lg:` for larger screens. Support dark mode via tokens.

### 4. Server vs Client Components

- Server Components by default. Add `'use client'` only at leaf components that need state, effects, or browser APIs.
- Fetch data in Server Components; pass serializable props down. Never import `server-only` modules into client code.
- `cacheComponents` is on: data is dynamic by default; opt in to caching with `use cache`. Anything reading `cookies()`/`headers()`/session must sit behind `<Suspense>` (see the cache-components auth guide).

### 5. Mutations & Validation

- Mutations are Server Actions (`'use server'`). Parse all input with a zod schema from `src/domain/`, and re-check the session/authorization inside every action — never trust the client.
- Return typed results (`{ ok: true, data } | { ok: false, errors }`); no thrown strings.
- Forms: progressive enhancement via `<form action>`; client-side validation reuses the same zod schema.

### 6. Supabase

- Access Supabase only through `src/lib/supabase/*` clients. Create a fresh server client per request.
- **Never** expose the service-role key: no `NEXT_PUBLIC_` prefix, never in client code, never committed. Prefer RLS-protected user clients; service-role use must be server-only, isolated, and justified in the PR.
- Every table has RLS enabled and explicit policies. Schema changes only via `supabase/migrations`.

### 7. Identifiers (testing)

Every interactive element and key region declares a unique, descriptive `data-testid`:

```tsx
<button data-testid="btn-order-confirm" onClick={...} />
```

### 8. Accessibility

- WCAG 2.2 AA: semantic HTML, labelled controls, visible focus, sufficient contrast, keyboard operable.
- Touch targets at least 44×44 px (`min-h-11 min-w-11`).
- Respect `prefers-reduced-motion`; no information by color alone.

### 9. Immutability

Never mutate state/props in place. Use spread, `map`, `filter`, `toSorted`, etc.

### 10. Environment

- Parse env through `src/config/env.ts` (zod). `NEXT_PUBLIC_*` values are browser-visible: never put secrets there. Update `.env.example` when adding variables.

### 11. Validation — Before a PR

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run format:check
npm run build
```

All must pass with zero errors. Coverage must not decrease: never lower the ratcheting thresholds in `vitest.config.mts`; commit them when `test:coverage` raises them. Agents never merge PRs.

### 12. Git & Branching

- Branch model: `develop` → `staging` → `main`. Feature branches are cut from `develop`; **PRs target `develop` only**. Promotion to `staging`/`main` is done by maintainers.
- Conventional commits with issue reference: `feat(orders): add status filters (#42)`.
- Backlog: pick work with `python3 -B .agents/skills/issue-logger/scripts/gh_issue.py next -n <N> --type story|bug|all` (ask the user which type if unspecified and bugs are open) and follow `.agents/rules/github_issue.md`; create issues only via the `issue-logger` skill.

### 13. Architectural Separation

- Presentation (JSX/Tailwind), data access (Supabase + Server Actions), and domain (types, zod, pure logic) stay separate. Domain code has no React/Next/Supabase imports.
- Keep `layout.tsx`, `proxy.ts` thin; put logic in `lib/` or `features/`.
- Keep seed/mock data modular so it can be swapped for Supabase queries.

### 14. Design Reference

UI specs live in the legacy repo (`backup-react-web-version/ui-templates/`) and, going forward, the design-system MCP (see Phase 5 of the migration plan). Document deviations in `STITCH_EVOLUTION.md`.

### 15. Knowledge Graph

Use `graphify query` / `path` / `explain` before broad code exploration; run `graphify update .` after code changes (see `.agents/rules/graphify.md`).
