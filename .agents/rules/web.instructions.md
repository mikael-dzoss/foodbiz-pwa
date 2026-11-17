---
applyTo: "src/**"
paths:
  - "src/**"
description: Next.js App Router, rendering, styling, accessibility and PWA rules for code under src/
---

# Web Rules (`src/**`)

## Routing & Structure

- App Router only (`src/app`). Storefront routes live under `src/app/[locale]` (public, SEO, EN/FR); the manager app under `src/app/manage` (`login`, and `(authenticated)` for signed-in pages).
- `src/proxy.ts` replaces `middleware.ts` (never add one). Keep it thin: session refresh and redirects (CSP headers are planned, not built).
- `loading.tsx`, `error.tsx`, `not-found.tsx` per route segment; `next/link` and `next/image`.
- New routes update the shared nav component.

## Rendering & Caching

- Server Components by default; `'use client'` only at leaves that need state, effects or browser APIs. Pass serializable props down; never import `server-only` modules into client code.
- `cacheComponents: true`: dynamic by default; cache explicitly with `use cache` (+ `cacheLife`/cache tags). Runtime data (`cookies()`, `headers()`, `searchParams`, session) is read behind `<Suspense>`.
- Storefront pages are server-rendered from cached catalog data and indexable (metadata API, semantic HTML; sitemap and robots are planned).

## State, Mutations & Forms

- Server state lives in the database: read in Server Components through `server-only` `*-data.ts` modules (errors throw to `error.tsx`), mutate via Server Actions (`'use server'`), then revalidate (`revalidatePath`/`updateTag`; `revalidateStorefrontCatalog()` for anything the public storefront shows).
- Every Server Action is `defineAction(...)` from `src/lib/actions/define-action.ts` and returns `ActionResult<T>` (`{ ok: true, data } | { ok: false, code, message, ... }`, see `src/lib/actions/types.ts`); clients map `code` to dictionary text; no raw error text, no thrown strings.
- Forms: `<form action>` (progressive enhancement); client-side validation reuses the same zod schema from `src/domain/`; field errors are announced accessibly.
- Local UI state with React hooks; no global client store unless justified.

## Styling (Tailwind v4)

- Utility classes + tokens from `@theme` in `src/app/globals.css` ([DESIGN_SYSTEM.md §2](../../docs/design/DESIGN_SYSTEM.md#2-colour-tokens)). No `style={{}}`, no raw hex/px; an arbitrary value like `w-[137px]` means a token is missing.
- Mobile-first: base classes for phones (test at 360 px), then `sm:`/`md:`/`lg:`. Dark mode via tokens.
- Class order is Prettier's job (`npm run format`).

## Accessibility & Testability

- WCAG 2.2 AA: semantic HTML, labelled controls, visible focus, keyboard operable, no information by colour alone, respect `prefers-reduced-motion`.
- Touch targets ≥ 36 × 36 px (`min-h-9 min-w-9`); 32 px only for the owner-approved exceptions listed there; don't enlarge a control that already meets 36 px at the cost of the layout ([DESIGN_SYSTEM.md §5](../../docs/design/DESIGN_SYSTEM.md)).
- Every interactive element and key region has a unique, descriptive `data-testid` (e.g. `btn-order-confirm`).

## PWA

- Manifest: `src/app/manifest.ts`; icons: `public/icons/`. There is no service worker yet; if one is added (`public/sw.js`), keep it excluded from the proxy matcher and never let it cache authenticated responses.
- Offline degrades gracefully with a clear offline state.

## Performance

- Lighthouse ≥ 90 (all four categories) on mobile.
- Paginate/virtualize large lists; stable `key`s; no heavy work in render.
- Images via `next/image`, WebP/AVIF preferred.
