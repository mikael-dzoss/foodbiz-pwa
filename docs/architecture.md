# Architecture

One Next.js codebase serves two installable PWA audiences: the **customer storefront** (public, server-rendered, EN/FR, under `src/app/[locale]`) and the **manager dashboard** (behind Google sign-in, under `src/app/manage`). Data lives in Supabase. Nothing is deployed yet: see [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Stack

Versions come from [`package.json`](../package.json).

| Layer      | Technology                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16.4 (App Router, Cache Components, Turbopack), React 19.3                                                                                   |
| Language   | TypeScript 5 (strict), Node 22 or later                                                                                                              |
| Styling    | Tailwind CSS 4, Radix UI primitives, `lucide-react` icons, Inter font (`next/font`)                                                                  |
| Backend    | Supabase (Postgres, Auth, Storage, Realtime) through `@supabase/ssr` and `supabase-js`                                                               |
| Validation | zod 4                                                                                                                                                |
| Testing    | Vitest 5 and React Testing Library, Playwright with axe, pgTAP                                                                                       |
| Hosting    | Vercel Hobby for v0.9; Netlify Free for v1 production if the spike passes ([ADR 0001](decisions/0001-hosting-and-backups.md)); no project exists yet |

`next.config.ts` enables `cacheComponents` and `partialPrefetching`, and allows `next/image` to load only the project's public `product-images` Storage bucket. This Next.js version differs from older ones; read `node_modules/next/dist/docs/` before using an API.

## Layers

Dependencies point one way: `domain` ← `lib/repositories` ← `features` ← `app`.

| Folder            | Holds                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/`     | zod schemas and types, pure logic (pricing, KPIs, order lifecycle, anti-abuse limits), i18n dictionaries, repository interfaces                 |
| `src/config/`     | Env parsing (`env.ts`) and app metadata                                                                                                         |
| `src/lib/`        | `repositories/` (mock and Supabase adapters), `supabase/` (clients, storage, realtime), `auth/` (session, access), rate limiter                 |
| `src/features/`   | One folder per feature (storefront, orders, products, expenses, customers, dashboard, settings, auth, manager): Server Actions and components   |
| `src/components/` | Shared UI primitives (`ui/`), feedback, navigation, theme, icons                                                                                |
| `src/app/`        | Routes, layouts, web app manifests (`[locale]/manifest.webmanifest`, `manage/manifest.webmanifest`), `globals.css`; thin, they compose features |
| `src/proxy.ts`    | Request proxy (Next.js 16 name for middleware): session refresh                                                                                 |
| `supabase/`       | Migrations, pgTAP tests (`supabase/tests/`), `seed.sql`, `config.toml`                                                                          |

`domain/` imports no React, Next or Supabase. Rules per layer: [`AGENTS.md`](../AGENTS.md#rules) and [`.agents/rules/`](../.agents/rules/).

### Example: placing an order

1. `checkout-form.tsx` (client component in `features/storefront/components/`) calls `placeOrderAction`.
2. `placeOrderAction` (`features/storefront/storefront-actions.ts`) parses the input with the zod schema from `domain/checkout.ts`, checks the honeypot and quantity caps, applies the per-IP limiter, then re-reads prices and stock and recomputes totals on the server.
3. It gets repositories from `getStorefrontRepositories()` (`lib/repositories/storefront.ts`) and calls `repos.orders.place(businessId, input)`. The business id comes from `STOREFRONT_BUSINESS_ID`, never from the request.
4. In Supabase mode the adapter (`lib/repositories/supabase/adapter.ts`) calls the `place_order` Postgres function through `client.rpc("place_order", ...)`. The function locks and decrements stock, resolves the guest by phone, enforces the limits below and returns the order and its tracking token.
5. On success the action calls `revalidateStorefrontCatalog()` (`updateTag` on the catalog tags) and `revalidatePath` for the manager orders and products pages.

## Repository pattern and data source

`domain/repositories/types.ts` defines the `Repositories` interface. Two adapters implement it:

- **Mock** (`lib/repositories/mock/`): in-memory fixtures, process-local. Used for local development and the mock-mode Playwright suite.
- **Supabase** (`lib/repositories/supabase/`): the real implementation, subject to RLS.

`DATA_SOURCE` (`mock` or `supabase`, default `mock`) selects the adapter in `getRepositories()` (`lib/repositories/factory.ts`). `src/config/env.ts` rejects `DATA_SOURCE=mock` when `NODE_ENV` or `APP_ENV` is `production`, so a production build cannot run on mock data. The `build` script therefore defaults `DATA_SOURCE` to `supabase`. `DATA_SOURCE=supabase` also requires `STOREFRONT_BUSINESS_ID`.

The storefront does not use `getRepositories()`. Every code path an anonymous visitor reaches uses `getStorefrontRepositories()`, which builds the Supabase adapter on the cookie-less public client with `publicOnly: true`, so reads select public columns only. The storefront serves one business: `getStorefrontBusinessId()` returns `STOREFRONT_BUSINESS_ID` (or the demo business in mock mode).

## Server Actions and data access

- **Writes** are Server Actions built with `defineAction(name, { auth, input }, handler)` (`src/lib/actions/define-action.ts`). It checks auth outside the try (a login redirect is never swallowed), parses `input` with zod, runs the handler and returns `ActionResult<T>` (`src/lib/actions/types.ts`): `{ ok: true, data }` or `{ ok: false, code, message, reason?, fieldErrors?, lineErrors? }`. `code` is one of `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`. Handlers return data or throw `ActionError(code, safeMessage)`; `OrderRepoError` and `OwnerRequiredError` are mapped, Next control-flow errors are rethrown (`unstable_rethrow`), anything else is logged and returned as `INTERNAL` with fixed text, never raw database text. `auth: "owner"` is for owner-only actions.
- **Reads** are `server-only` data modules (`*-data.ts` next to the feature, e.g. `features/customers/customer-data.ts`) called directly from pages and layouts. A read failure throws to the route's `error.tsx`; it is never an empty list. Only reads triggered from the browser (the order-alert poll, the guest phone lookup) stay Server Actions.

## Server logs

Server events are one JSON line each (`logEvent` in `src/lib/log.ts`): `time`, `level`, `event`, `appEnv` plus flat fields. Vercel captures them from stdout/stderr.

- `request_error` (`src/instrumentation.ts` `onRequestError`): error name, `digest`, method, `routerKind`, `routePath` (the route template, e.g. `/[locale]/order/[token]`), `routeType`, `renderSource`, `revalidateReason`. Outside production it adds the message and a stack cut to 2,000 characters.
- `action_error` (`defineAction`): action name and error class.
- Never logged: the concrete path or query string (they can carry tracking tokens or phone numbers), headers, cookies, bodies, session data, and in production the error message (database errors can echo row values). Next still prints the original error; `digest` links it to the structured line.
- Staging and production must never set `APP_ENV` to `development` or `test`: that is the only switch that adds messages and stacks to deployed logs.
- Anti-abuse rejections keep their own `[anti-abuse]` line with hashed IP and phone (`src/lib/anti-abuse-log.ts`).

## Supabase clients

All Supabase access goes through `src/lib/supabase/`.

| Client             | Function (file)                          | Used from                                                                                 |
| ------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Browser            | `createClient` (`client.ts`)             | Client components; today only the order alerts subscription (`features/orders/alerts`)    |
| Per-request server | `createClient` (`server.ts`)             | Server Components, Server Actions, Route Handlers; reads and writes auth cookies          |
| Cookie-less public | `createPublicServerClient` (`server.ts`) | `getStorefrontRepositories()`; reads no cookies, so it is safe inside `use cache`         |
| Session refresh    | `updateSession` (`proxy.ts`)             | `src/proxy.ts`                                                                            |
| Service-role admin | `createAdminClient` (`admin.ts`)         | Only `lib/auth/dev-provisioning.ts`; throws unless the environment is development or test |

`server.ts` and `admin.ts` import `server-only`. The service-role key is parsed only in the server env schema, is never `NEXT_PUBLIC_*` and is never read by client code. The `db:provision-member` script (`scripts/provision-member.mjs`) takes the key from its own environment.

## Auth and session flow

1. `/manage/login` offers Google sign-in. `signInWithGoogleAction` (`features/auth/actions.ts`) calls `signInWithOAuth` with `redirectTo` set to `<NEXT_PUBLIC_SITE_URL>/auth/callback`. In production `NEXT_PUBLIC_SITE_URL` is required; outside production the action falls back to the request origin.
2. Google returns to Supabase Auth, which redirects to `/auth/callback` (`app/auth/callback/route.ts`). The route exchanges the code for a session (PKCE), then calls `getManagerSession()`. A signed-in user with no `business_members` row is sent to `/manage/login?error=no_access`.
3. `src/proxy.ts` runs on every request except static assets. In Supabase mode it calls `updateSession`, which creates a server client and calls `auth.getClaims()` to refresh the session cookie, and redirects unauthenticated `/manage/*` requests (except `/manage/login`) to the login page. In mock mode it only checks the mock cookie.
4. The proxy is a convenience, not the boundary. The checks that count: `(authenticated)/layout.tsx` and pages such as the dashboard call `requireManagerSession()`, every manager Server Action goes through `defineAction` (below), which calls `requireAuthenticatedAction()` or `requireOwnerAction()` (`features/auth/server-action-guard.ts`); the session lookup is `React.cache`d, so it runs once per request, and RLS in Postgres restricts rows to business members.

`getManagerSession()` uses `auth.getUser()` and looks up the membership. In development and test only, an email in `ALLOWED_MANAGER_EMAILS` is auto-provisioned to the demo business. The membership roles are `owner`, `manager` and `staff`; staff accounts and roles are tracked in [#135](https://github.com/mikael-dzoss/foodbiz-pwa/issues/135).

## Caching

`cacheComponents` is on, so routes are dynamic unless a function opts into caching. The only cached data is the storefront catalog: `getStorefrontCatalog()` and `getStorefrontProduct()` in `features/storefront/catalog-data.ts` use `"use cache"`, `cacheLife("hours")` and the tags `storefront-catalog`, `storefront-catalog-<businessId>` and `storefront-product-<id>`. Anything that changes catalog data (placing an order, product, category and settings actions) calls `revalidateStorefrontCatalog()` (`updateTag` for read-your-own-writes, plus `revalidatePath("/[locale]", "layout")`). Storefront and manager pages export `instant = false` and are allowed to block on the server. Manager data is not cached: it is read per request after the session check. The storefront catalog is prerendered at build time, so a build needs a reachable Supabase.

## Abuse protection

Order placement is public, so the limits live in the database where direct calls to the Supabase API cannot skip them (`place_order`, migrations `...0011` to `...0015`):

- Quantity caps: 50 per line, 100 per order, 50 lines.
- Idempotency: a repeated `idempotencyKey` returns the original order and creates nothing (unique index on `(business_id, idempotency_key)`).
- Rate limits stored in `rate_limit_attempts`: 3 orders per 10 minutes per hashed phone, 120 per 10 minutes per business. Order lookup by ticket number and phone is limited to 5 failed attempts per 10 minutes per phone.

`placeOrderAction` adds a honeypot field, the same quantity caps, and an in-memory per-IP limiter (5 orders per 10 minutes, `lib/rate-limiter.ts`). The database cannot see client IPs, so this is the only IP-based layer. Rejections are logged with salted hashes of IP and phone (`lib/anti-abuse-log.ts`). Limits are constants in `domain/anti-abuse.ts`; `supabase/tests/public_surface.test.sql` checks the database side.

## Realtime order alerts

`features/orders/alerts/order-alerts-context.tsx` (mounted in the manager shell) subscribes to `INSERT` events on `orders` for the manager's business through `subscribeToOrderInserts` (`lib/supabase/realtime.ts`), using the browser client. The helper validates the business id as a UUID and joins the channel only after the session token is set. A new order shows a toast and plays a chime if sound alerts are enabled in settings. The `orders` table is added to the Realtime publication by migration `...0004`.

## Testing layers

| Layer                   | Command                             | Notes                                                                                                                                                                               |
| ----------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit and component      | `npm test`, `npm run test:coverage` | Vitest with coverage floors; the shared repository contract suite (`lib/repositories/tests/contracts/`) runs against the mock adapter and the Supabase adapter with a mocked client |
| Live Supabase contracts | `npm run test:live`                 | Needs local Supabase; RLS boundaries, tenant isolation, concurrent stock, storage and realtime against the real stack                                                               |
| Database                | `npm run db:test`                   | pgTAP files in `supabase/tests/`                                                                                                                                                    |
| Mock-mode browser       | `npm run test:e2e`                  | Playwright against `DATA_SOURCE=mock` (port 3100), includes axe checks                                                                                                              |
| Supabase-mode journey   | `npm run test:e2e:supabase`         | One anonymous checkout journey against local Supabase (`e2e-supabase/`)                                                                                                             |

Which tiers a change needs, and the CI cost, are in [`CONTRIBUTING.md`](CONTRIBUTING.md#validation-gate).

## PWA

Both the customer storefront and the manager dashboard are installable as separate PWAs with distinct manifests served by route handlers (Next.js only treats `manifest.*` as a metadata file at the app root):

- **Storefront** (`src/app/[locale]/manifest.webmanifest/route.ts`): `id: "/"`, `scope: "/"`, `start_url: "/{locale}"`, shop name and description from cached `getStorefrontCatalog()`, linked via `metadata.manifest` in `src/app/[locale]/layout.tsx`.
- **Manager** (`src/app/manage/manifest.webmanifest/route.ts`): `id: "/manage"`, `scope: "/manage/"`, `start_url: "/manage"`, `"FoodBiz Manager"`, linked via `metadata.manifest` in `src/app/manage/layout.tsx`.

Both reuse the shared colours and icons (`public/icons/`: 192/512 PNG, maskable 512 PNG, SVG) from `src/config/app.ts`, and each section layout sets its own `applicationName` and `appleWebApp.title`. `src/proxy.ts` excludes `*.webmanifest` so browsers can fetch either manifest without auth cookies. `use-pwa-install.ts` and `install-app-card.tsx` provide an install prompt. There is no service worker.

## Data model

Tables, enums, indexes, RLS and function descriptions: [`database/schema.md`](database/schema.md). Entity fields and business rules: [`FUNCTIONAL_SPECIFICATION.md`](FUNCTIONAL_SPECIFICATION.md).

## Security headers

`next.config.ts` `headers()` sets, on every route, a static CSP plus `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY` and (real HTTPS deployments only) `Strict-Transport-Security` and `upgrade-insecure-requests`. The values come from `src/config/security-headers.ts`; Supabase hosts derive from `NEXT_PUBLIC_SUPABASE_URL`. HSTS omits `includeSubDomains`/`preload` until every subdomain of the production domain is confirmed HTTPS-only. A production build fails if `NEXT_PUBLIC_SUPABASE_URL` is missing or invalid, since the CSP would otherwise block Supabase. `src/proxy.ts` is untouched.

Why no nonces: the Next 16 CSP guide says nonces require dynamic rendering and are incompatible with PPR, which conflicts with the cached shells of `cacheComponents`. The "Without Nonces" static header is used instead. `script-src` and `style-src` keep `'unsafe-inline'` because Next's inline bootstrap/flight scripts, the theme script and component inline styles cannot be hashed statically. Experimental SRI was not adopted: it does not remove inline scripts, so it would not let us drop `'unsafe-inline'`. `'unsafe-eval'` is dev only. XSS protection therefore relies on React escaping, no `dangerouslySetInnerHTML`, `object-src 'none'`, `base-uri 'self'` and `frame-ancestors 'none'`. Allowed third parties: the Supabase project (img, connect incl. `wss://`, form-action for the OAuth redirect), `accounts.google.com` (form-action) and `www.openstreetmap.org` (the shop-info map iframe). Revisit when a nonce-friendly rendering model is acceptable.

`/patterns` (design reference) returns 404 unless both `NODE_ENV` and `APP_ENV` are development or test.

## Known limitations

- No pagination. List queries are not paged, and the local `supabase/config.toml` caps PostgREST responses at 1,000 rows (`max_rows`); the hosted project's cap is unverified.
- No service worker and no offline support.
- The CSP keeps `'unsafe-inline'` for scripts and styles (see [Security headers](#security-headers)).
- No error tracking; Server Action failures are written with `console.error` only ([#109](https://github.com/mikael-dzoss/foodbiz-pwa/issues/109)).
- The storefront is bound to one business through `STOREFRONT_BUSINESS_ID`; there is no host or path based tenant selection.
- The per-IP limiter is in memory, per server instance, and resets on restart. The database limits are not affected.
- The abuse log uses a per-process salt, so hashes cannot be correlated across instances.
- No business timezone. Date handling uses UTC (`toISOString`, `timeZone: "UTC"`), so a day boundary for a business outside UTC is wrong by its offset. Store opening hours are compared with the server clock.
- The storefront is EN/FR. The manager area has a language setting, but several screens (for example most settings pages) read `DEFAULT_LOCALE` (English).
- Nothing is deployed: no staging or production environment exists.
