---
applyTo: "src/**"
paths:
  - "src/**"
description: Next.js App Router, rendering, styling, accessibility and PWA rules for code under src/
---

# Web Rules (`src/**`)

## Routing & Structure

- App Router only (`src/app`). Storefront routes live under `src/app/[locale]` (public, SEO, EN/FR); the manager app under `src/app/manage` (`login`, and `(authenticated)` for signed-in pages).
- `src/proxy.ts` replaces `middleware.ts` (never add one). Keep it thin: session refresh, redirects, CSP headers.
- `loading.tsx`, `error.tsx`, `not-found.tsx` per route segment; `next/link` and `next/image`.
- New routes update the shared nav component.

## Rendering & Caching

- Server Components by default; `'use client'` only at leaves that need state, effects or browser APIs. Pass serializable props down; never import `server-only` modules into client code.
- `cacheComponents: true`: dynamic by default; cache explicitly with `use cache` (+ `cacheLife`/cache tags). Runtime data (`cookies()`, `headers()`, `searchParams`, session) is read behind `<Suspense>`.
- Storefront pages are statically shell-rendered and indexable (metadata API, sitemap, semantic HTML).

## State, Mutations & Forms

- Server state lives in the database: read in Server Components, mutate via Server Actions (`'use server'`), then revalidate (`revalidatePath`/`revalidateTag`/`updateTag`).
- Server Actions return typed results (`{ ok: true, data } | { ok: false, errors }`); no thrown strings.
- Forms: `<form action>` (progressive enhancement); client-side validation reuses the same zod schema from `src/domain/`; field errors are announced accessibly.
- Local UI state with React hooks; no global client store unless justified.

## Styling (Tailwind v4)

- Utility classes + tokens from `@theme` in `src/app/globals.css` ([DESIGN_SYSTEM.md §2](../../docs/design/DESIGN_SYSTEM.md#2-colour-tokens)). No `style={{}}`, no raw hex/px; an arbitrary value like `w-[137px]` means a token is missing.
- Mobile-first: base classes for phones (test at 360 px), then `sm:`/`md:`/`lg:`. Dark mode via tokens.
- Class order is Prettier's job (`npm run format`).

## Accessibility & Testability

- WCAG 2.2 AA: semantic HTML, labelled controls, visible focus, keyboard operable, no information by colour alone, respect `prefers-reduced-motion`.
- Touch targets ≥ 44 × 44 px (`min-h-11 min-w-11`).
- Every interactive element and key region has a unique, descriptive `data-testid` (e.g. `btn-order-confirm`).

## PWA

- Manifest: `src/app/manifest.ts`; icons: `public/icons/`. There is no service worker yet; if one is added (`public/sw.js`), keep it excluded from the proxy matcher and never let it cache authenticated responses.
- Offline degrades gracefully with a clear offline state.

## Performance

- Lighthouse ≥ 90 (all four categories) on mobile.
- Paginate/virtualize large lists; stable `key`s; no heavy work in render.
- Images via `next/image`, WebP/AVIF preferred.
