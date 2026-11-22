# ADR 0001: Hosting and database backups

- **Status:** Accepted (production host confirmed after the Netlify spike)
- **Date:** 2026-11-22
- **Scope:** Where the Next.js app runs for v0.9 and v1, whether Supabase stays, and how data is backed up
- **Tracking:** Epic [#326](https://github.com/mikael-dzoss/foodbiz-pwa/issues/326): spike #327, Netlify setup #328, credit guards #329, nightly backup #330, restore test #331, uptime monitoring #332

## Context

The goal is the cheapest stack that still needs no complex manual setup, integrates smoothly, meets the security and GDPR requirements, and can be backed up and restored easily. Customers are small businesses that will not pay a monthly fee before the platform brings them orders.

Facts, checked on 2026-11-22 (prices change often; recheck them before quoting a customer):

- **Vercel Hobby is free but limited to non-commercial, personal use.** A storefront that takes orders for a business counts as commercial, so production on Vercel means Pro at $20 per seat per month.
- **Supabase Free** gives a 500 MB database and 2 active projects per organisation. A project pauses (it is not deleted) after a week without activity, and can be restored from the dashboard. Free has no backups to rely on and no point-in-time recovery. Pro costs $25 per month and adds daily backups kept for 7 days.
- **Netlify Free** allows commercial use and deploys Next.js 16 through its OpenNext adapter. It includes 300 credits per month, with a hard cap: when they run out, every site shows "Site not available" until the next cycle. Rates: 15 credits per production deploy, 20 per GB of bandwidth, 2 per 10,000 web requests, 10 per GB-hour of compute. Deploy previews, branch deploys, failed deploys and rollbacks are free.
- **Coupling.** Only `vercel.json` is specific to Vercel; the app builds with `next build` and runs with `next start`. Supabase coupling is deep: Auth (Google OAuth), Storage (`product-images`), Realtime (order alerts), and RLS policies built on `auth.uid()` across all migrations.

## Decision

1. **v0.9 runs on Vercel Hobby.** Nothing commercial happens before v1: demo data only, no real orders. [#112](https://github.com/mikael-dzoss/foodbiz-pwa/issues/112) continues as planned.
2. **v1 production runs on Netlify Free, if a one-day spike passes.** The spike confirms that the features below work and measures how many credits real visits use. If it fails, the fallback is Vercel Pro, paid by the customer.
3. **Supabase Free stays** (EU region). Upgrade to Pro once a trigger below is reached.
4. **We run our own backups** whatever the Supabase plan: an encrypted nightly dump stored outside Supabase, and a scheduled restore test.
5. **Each customer owns their accounts** (Supabase organisation, hosting team, domain). The developer is added as a member. Billing and data ownership stay with the customer, and free-tier limits do not add up across clients.

### Spike pass criteria

The spike passes when all of these work on a Netlify deploy:

- the `use cache` catalog with `updateTag` revalidation
- the session refresh in `src/proxy.ts`
- Server Actions
- `next/image` from the Supabase `product-images` bucket
- the security headers and CSP from `next.config.ts`
- the Google OAuth callback
- JSON log lines from `src/lib/log.ts` showing up in Netlify's logs

It also measures the credits used by about 100 scripted visits.

## Options considered

| Option                                                           | Effort to move                                       | Monthly cost           | Why not chosen (or kept as fallback)                                                                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Netlify Free**                                                 | 2.5 to 3.5 days                                      | 0 € within 300 credits | Chosen, subject to the spike                                                                                                              |
| Vercel Pro                                                       | 0                                                    | $20 per seat           | Fallback if the spike fails                                                                                                               |
| VPS + Ansible (Hetzner, Caddy)                                   | 10 to 12 days, then 0.5 to 1 day per month of upkeep | 4 to 6 €               | You own OS patching, TLS, uptime and the single point of failure; no preview deploys. Only worth it if several customers share the server |
| Cloudflare Workers (OpenNext)                                    | Unknown                                              | 0 to $5                | Support for `cacheComponents` / `use cache` / `updateTag` could not be confirmed                                                          |
| Replace Supabase with Neon + separate auth, storage and realtime | Weeks                                                | 0 €                    | Rewrites Auth, Storage, Realtime and every RLS policy, which is security-sensitive work, to save money nobody spends yet                  |

### Netlify credit estimate (100 visits a day, 3,000 a month)

| Item                                                                 | Credits per month           |
| -------------------------------------------------------------------- | --------------------------- |
| Web requests (60 to 100 per visit)                                   | 36 to 60                    |
| Bandwidth (1 to 1.5 MB per visit; `next/image` is served by Netlify) | 60 to 90                    |
| Compute (about 8 server calls per visit, about 300 ms, 1 GB assumed) | 20 to 40                    |
| Four production deploys                                              | 60                          |
| **Total**                                                            | **about 180 to 250 of 300** |

Risks to the budget:

- **Production deploys**, at 15 credits each, are the main risk. Promote to `main` in batches; `staging` branch deploys are free.
- **Crawlers** can add 2 to 5 times the human traffic.
- **The fallback poll:** while Realtime is disconnected, the order-alert poll runs every 15 seconds (`order-alerts-context.tsx`).
- **Oversized images** add bandwidth.

The default function memory is not documented; the spike replaces these assumptions with measured numbers.

## Consequences

- **Avoid features tied to Vercel** (Blob, KV, Edge Config, Cron, Analytics, `@vercel/functions`) so the move stays cheap. Avoid Supabase-only features too (Edge Functions, Vault, `pg_net`). Business logic stays in plain SQL functions, and Storage and Realtime stay behind `src/lib/supabase/*`.
- **Backups:**
  - **Nightly:** a GitHub Actions job runs `pg_dump`, encrypts the dump with `age` (it contains customer phone numbers) and stores it in EU object storage outside Supabase, together with a sync of the `product-images` bucket.
  - **Retention:** 30 days, so a GDPR erasure is gone from backups within 30 days.
  - **Restore test:** on a schedule, the latest dump is restored into the local Supabase stack and `npm run db:test` is run against it.
  - **Actions budget:** a few minutes a day.
- **Uptime:** a free external monitor checks a route that reads from the database. It reports outages and keeps a quiet project from pausing.
- **The site can pause** if the credits run out. A usage alert at 70% and the budget rules above keep that risk low.

## Triggers to revisit

- **Supabase Pro:** the database passes about 400 MB, Storage passes about 0.8 GB, the customer needs point-in-time recovery, or the platform clearly pays for itself. Turn on the spend cap when upgrading.
- **Netlify:** credit use goes above about 80% for two months in a row, or the adapter blocks a needed Next.js feature. Move to Netlify Personal or Pro, or to Vercel Pro.
- **VPS:** several customers could share one server.
