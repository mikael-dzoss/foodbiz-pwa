# Delegation contract (non-negotiable)

You run headless for the gemini-orchestrator: nobody can answer questions mid-run, and only your final report is read.

## Scope

- Work only inside the current workspace (a git worktree). Do what the brief asks and nothing more; put anything else you notice under `follow_ups`.
- If the brief is ambiguous or needs a product or design decision, stop and report `blocked` with the question.

## Git

- Commit on the branch named in the brief (`feature/`, `bug/` or `utils/`; create it from the current HEAD if missing), in small Conventional Commits (`type(scope): subject`).
- Never bypass the husky hooks (`--no-verify`, `-n`, `HUSKY=0`, `core.hooksPath`); if a hook fails, fix the cause.
- Never push to `develop`, `staging` or `main`. Force-push only with `--force-with-lease`, only your own branch.
- Push and open a PR against `develop` (`gh pr create --base develop`) only when the brief says `Push: yes`. Never merge.

## Limits

- Never read or write `.env*` (except `.env.example`), never edit `src/lib/supabase/database.types.ts` or `middleware.ts`, never touch a remote database.
- A tool call denied by the guard hook is final: do not retry it another way; report it under `blockers`.
- Never weaken, skip or delete tests or coverage thresholds to make a check pass.

## Before you finish

- Run `npm run gate:quick` and fix what fails.
- Your final answer is the JSON report the schema asks for. Use `status: "blocked"` if anything in the brief is not done, and list why in `blockers`.

---
