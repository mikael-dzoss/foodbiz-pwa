---
trigger: always_on
---

# FoodBiz PWA — Web Constraints

Next.js 16 App Router PWA. Mobile-first, installable. Read the bundled docs in `node_modules/next/dist/docs/` before using an API.

## Routing & Structure

- App Router only (`src/app`). Route groups for audiences, e.g. `(storefront)` (public, SEO) and `(dashboard)` (authenticated manager).
- `src/proxy.ts` is the request proxy (`middleware.ts` is deprecated). Keep it thin: session refresh, redirects, CSP headers. It is not the only auth check — verify in data access and Server Actions too.
- Use `loading.tsx`, `error.tsx`, `not-found.tsx` per route segment; use `next/link` and `next/image`.
- Don't add routes/navigation entries without updating the shared nav component.

## Rendering & Caching

- `cacheComponents: true`: dynamic by default; cache explicitly with `use cache` (+ `cacheLife`/cache tags). Runtime data (`cookies()`, `headers()`, `searchParams`) must be read behind `<Suspense>`.
- Server Components by default; `'use client'` at leaves only. Keep client bundles small.
- Storefront pages should be statically shell-rendered and indexable (metadata API, sitemap, semantic HTML).

## State & Data

- Server state lives in the database; read in Server Components, mutate via Server Actions, then revalidate (`revalidatePath`/`revalidateTag`/`updateTag`).
- Local UI state with React hooks; avoid global client stores unless justified.
- Immutable updates only (spread/`map`), never `.push()` on state.
- Forms: `<form action>` + zod schemas from `src/domain/`; show field errors accessibly.

## Styling (Tailwind v4)

- Utility classes + tokens from `@theme` in `src/app/globals.css`. No inline `style`, no raw hex.
- Mobile-first breakpoints; test at 360px width. Touch targets ≥ 44px.
- Prettier (`prettier-plugin-tailwindcss`) orders classes — run `npm run format`.

## PWA

- Manifest at `src/app/manifest.ts`; icons in `public/icons/`. Service worker in `public/sw.js` must be excluded from the proxy matcher (already is) and never cache authenticated API responses.
- Offline behavior must degrade gracefully; show clear offline state.

## Performance & Quality

- Target Lighthouse ≥ 90 (Performance, Accessibility, Best Practices, SEO) on mobile.
- Lists: paginate/virtualize large sets; stable `key`s; no anonymous heavy work in render.
- Images via `next/image`, WebP/AVIF preferred.
- Every interactive element has `data-testid`.
