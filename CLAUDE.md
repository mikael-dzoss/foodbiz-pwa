@AGENTS.md

## Claude Code

Everything above is the shared contract; this section only maps it onto Claude Code primitives. Never copy shared rules here: edit `AGENTS.md` or `.agents/`.

- **Rules:** `.claude/rules/*.md` are symlinks into `.agents/rules/`, auto-loaded by their `paths:` frontmatter (`graphify` always). `github_issue` and `mcp` load on demand from [Where to look](#where-to-look).
- **Skills:** `.claude/skills` → `.agents/skills` (`/issue-logger`, `/stacked-pr-workflow`, `/ponytail`, `/graphify`, …).
- **Subagents** (`.claude/agents/`): delegate the validation gate to `verifier` and keep its output out of the main context. Before opening a PR, run `migration-reviewer` if `supabase/migrations/` changed, `security-reviewer` for auth/session/env/Server Action changes, and `ui-reviewer` for `.tsx` changes.
- **Hooks** (`.claude/hooks/`) enforce protected branches and `--no-verify`, block secret/generated files (`.env*`, `database.types.ts`, `middleware.ts`), format edited files with Prettier, and refresh graphify after `src/` changes. If a hook blocks you, fix the cause; don't work around it.
- **MCP:** Stitch and Vercel come from `.mcp.json` (needs `STITCH_API_KEY` / `VERCEL_API_TOKEN` in the env).
