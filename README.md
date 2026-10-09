# FoodBiz PWA

Progressive Web App rewrite of FoodBiz Manager: one Next.js codebase serving the **manager dashboard** (installable PWA) and the **customer storefront** (SSR, SEO-friendly).

## Getting started

```bash
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm install
npm run dev                  # http://localhost:3000
```

Or open the folder in VS Code and choose **Reopen in Container** — `.devcontainer/` installs everything.

Stitch (design MCP): Copilot prompts for the key ([`.vscode/mcp.json`](.vscode/mcp.json)); for Antigravity, export `STITCH_API_KEY` on the host before opening the devcontainer.

## Where next

- Stack, folder layout, data flow: [`docs/architecture.md`](docs/architecture.md)
- Branches, commits, validation gate: [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)
- All docs: [`docs/README.md`](docs/README.md) · Agent contract: [`AGENTS.md`](AGENTS.md)

## License

MIT
