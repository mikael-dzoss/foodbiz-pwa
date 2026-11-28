# FoodBiz PWA

Progressive Web App rewrite of FoodBiz Manager: one Next.js codebase serving the **customer storefront** (public, server-rendered, EN/FR) and the **manager dashboard** (installable PWA, Google sign-in). Nothing is deployed yet; see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Quick start

Open the folder in VS Code and choose **Reopen in Container**. `.devcontainer/` installs dependencies (`npm ci`), the Supabase CLI and Docker-in-Docker, and copies `.env.example` to `.env.local` on first start.

### Mock mode (no database)

`.env.example` defaults to `DATA_SOURCE=mock`, which serves in-memory demo data.

```bash
npm run dev          # http://localhost:3000 (storefront), /manage/login (dashboard; mock sign-in, no Google needed)
```

Mock mode is refused in production builds.

### Supabase mode (local database)

```bash
npm run db:start     # local Supabase: API :54321, Studio :54323; applies migrations and seed.sql
npm run db:status    # prints the API URL and keys
```

In `.env.local`, set `DATA_SOURCE=supabase`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the status output, and keep `STOREFRONT_BUSINESS_ID` as in `.env.example` (the seeded demo business). Then `npm run dev`. Other commands: `npm run db:reset` (reapply migrations and seed), `npm run db:stop`.

Manager sign-in uses Google OAuth. Locally, copy `supabase/.env.example` to `supabase/.env` and add a Google client ID and secret ([setup](docs/DEPLOYMENT.md#google-sign-in-supabase-auth-active)). To get manager access either set `ALLOWED_MANAGER_EMAILS` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (development only, auto-provisions the demo business), or provision a member after that user has signed in once:

```bash
npm run db:provision-member -- --business-slug la-petite-boulangerie --email <email> --role manager
```

### Checks

```bash
npm run gate         # runs the checks your change needs; see docs/CONTRIBUTING.md
```

MCP servers (Stitch, Vercel) and `gh`: put `STITCH_API_KEY`, `VERCEL_API_TOKEN` and `GH_CLI_PAT` in the host env file `~/.devcontainer-data/foodbiz-pwa/env` (created on first open; see [`.devcontainer/README.md`](.devcontainer/README.md)). Copilot and Claude Code both read [`.mcp.json`](.mcp.json) (Antigravity installs via `node scripts/setup-agy-mcp.mjs`).

## Documentation

- [`docs/README.md`](docs/README.md): index of all docs
- [`docs/architecture.md`](docs/architecture.md): how the code is organised
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md): branches, commits, validation gate, CI
- [`AGENTS.md`](AGENTS.md): contract for coding agents

## License

All rights reserved; no licence is granted.
