@AGENTS.md

## Claude Code

Everything above is the shared contract; this section only maps it onto Claude Code primitives. Never copy shared rules here: edit `AGENTS.md`, `.agents/` or `.claude/` (subagents, hooks are shared with Copilot).

- **Rules:** `.claude/rules/*.md` are symlinks into `.agents/rules/`, auto-loaded by their `paths:` frontmatter (`graphify` always).
- **Skills:** `.claude/skills` → `.agents/skills` (`/ship`, `/issue-logger`, `/ponytail`, …). `/graphify` builds the graph and is user-invoked only; query it via the CLI per the graphify rule.
- **Subagents** (`.claude/agents/`): delegate `npm run gate` to `verifier` and keep its output out of the main context. Before opening a PR, run `migration-reviewer` if `supabase/migrations/` changed, `security-reviewer` for auth/session/env/Server Action changes, and `ui-reviewer` for `.tsx` changes.
- **Hooks** (`.claude/hooks/`): SessionStart prints the branch's issue and labels; `guard-git.mjs` enforces protected branches, force-push and `--no-verify`; `guard-files.sh` blocks secret/generated files (`.env*`, `database.types.ts`, `middleware.ts`); edited files are Prettier-formatted; graphify refreshes after `src/` changes. If a hook blocks you, fix the cause; don't work around it.
- **MCP:** `.mcp.json` (Stitch, Vercel; needs `STITCH_API_KEY` / `VERCEL_API_TOKEN` in the env).
