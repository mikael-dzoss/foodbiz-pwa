# FoodBiz PWA

Progressive Web App rewrite of FoodBiz Manager: one Next.js codebase serving the **manager dashboard** (installable PWA) and the **customer storefront** (SSR, SEO-friendly).

See [`migration_plan.md`](migration_plan.md) for the phased migration strategy.

## Stack

| Layer      | Technology                                                  |
| ---------- | ----------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Cache Components, Turbopack)        |
| Language   | TypeScript (strict)                                         |
| Styling    | Tailwind CSS v4 (shadcn/ui added in Phase 5)                |
| Backend    | Supabase (Postgres, Auth, Storage, RLS) via `@supabase/ssr` |
| Validation | zod                                                         |
| Testing    | Vitest + React Testing Library (jsdom)                      |
| Deployment | Vercel                                                      |

## Getting started

```bash
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm install
npm run dev                  # http://localhost:3000
```

Or open the folder in VS Code and choose **Reopen in Container** — `.devcontainer/` installs everything.

## Branches

| Branch    | Purpose                                                    |
| --------- | ---------------------------------------------------------- |
| `develop` | Integration branch. All feature PRs target it. Local only. |
| `staging` | Pre-production qualification (promoted from `develop`).    |
| `main`    | Production (promoted from `staging`).                      |

## Scripts

| Script                   | Purpose                               |
| ------------------------ | ------------------------------------- |
| `npm run dev`            | Dev server (Turbopack)                |
| `npm run build`          | Production build                      |
| `npm run lint`           | ESLint (`eslint-config-next`)         |
| `npm run typecheck`      | Generate route types + `tsc --noEmit` |
| `npm run test`           | Vitest (single run)                   |
| `npm run test:coverage`  | Vitest with v8 coverage               |
| `npm run format[:check]` | Prettier (+ Tailwind class sorting)   |

## Layout

```text
src/
├── app/               → Routes, layouts, manifest.ts (PWA)
├── config/            → env parsing (zod), app metadata
├── lib/supabase/      → browser / server clients + session refresh
└── proxy.ts           → Next.js proxy (Supabase session refresh)
```

## License

MIT
