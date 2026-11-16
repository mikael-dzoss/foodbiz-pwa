# FoodBiz PWA

Progressive Web App rewrite of FoodBiz Manager: one Next.js codebase serving the **manager dashboard** (installable PWA) and the **customer storefront** (SSR, SEO-friendly).

## Getting started

```bash
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm install
npm run dev                  # http://localhost:3000
```

Or open the folder in VS Code and choose **Reopen in Container** — `.devcontainer/` installs everything (including `docker-in-docker`, the Supabase CLI, and the Claude Code CLI + VS Code extension; Claude login and settings persist in the `foodbiz-pwa-claude-data` volume).

### Local Supabase stack

```bash
npm run db:start             # start local Supabase (API :54321, Studio :54323)
npm run db:reset             # reapply migrations + seed data (supabase/seed.sql)
npm run db:stop              # stop local Supabase containers
```

For local Google OAuth testing with the Supabase CLI, copy `supabase/.env.example` to `supabase/.env` and supply your Google Client ID and Secret (`supabase/.env` is git-ignored).

### Manager provisioning

Provision a manager or staff member for a business (server-side administrative CLI). Prerequisite: the user must have signed in with Google once so an auth record exists.

```bash
# Local development (local CLI stack):
npm run db:provision-member -- --business-slug <slug> --email <email> --role manager

# Hosted / remote production (requires --yes and real service-role key supplied outside the repo):
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<real-service-role-key>" \
npm run db:provision-member -- --business-slug <slug> --email <email> --role manager --yes
```

Stitch (design MCP): Copilot prompts for the key ([`.vscode/mcp.json`](.vscode/mcp.json)); for Antigravity, export `STITCH_API_KEY` on the host before opening the devcontainer.

## Where next

- Stack, folder layout, data flow: [`docs/architecture.md`](docs/architecture.md)
- Branches, commits, validation gate: [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)
- All docs: [`docs/README.md`](docs/README.md) · Agent contract: [`AGENTS.md`](AGENTS.md)

## License

MIT
