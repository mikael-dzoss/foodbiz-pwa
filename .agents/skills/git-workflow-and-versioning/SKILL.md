---
name: git-workflow-and-versioning
description: Commit discipline beyond the project rules. Use when committing, splitting a messy working tree into atomic commits, running parallel agents in git worktrees, or choosing a release version.
---

# Git Workflow and Versioning

Branch model, branch names, commit/PR format and the validation gate: [`docs/CONTRIBUTING.md`](../../../docs/CONTRIBUTING.md#branches). PRs and stacks: the [`ship`](../ship/SKILL.md) skill. Promotion and tagging: [`docs/DEPLOYMENT.md#releasing`](../../../docs/DEPLOYMENT.md#releasing). This skill adds only what those don't cover.

## Commits

- **Save points:** commit each working slice (tests green, typecheck clean) before starting the next. Never accumulate a large uncommitted diff.
- **Atomic:** one logical change per commit. Formatting, refactors and behaviour changes go in separate commits (ideally separate PRs).
- **Message body says why**, the diff already says what.
- **Before each commit:** `git diff --staged`, and check it for secrets (`git diff --staged | grep -iE "secret|password|api_key|token|service_role"`).
- **Splitting a messy tree:** `git add -p` per concern, commit, repeat; park the rest in a WIP commit (worktrees share one stash list).
- **Going back:** prefer `git restore <file>` or `git revert`. Ask before anything that discards work (`reset --hard`, `clean -f`, force-push outside stack restacks, which use `--force-with-lease`).

## Parallel agents: worktrees

One worktree per branch so agents don't collide:

```bash
git worktree add ../foodbiz-42 -b feature/42-order-status-filter origin/develop
git worktree remove ../foodbiz-42   # after merge
```

Never run two agents on the same branch or worktree. Database migrations stay sequential.

## PR change summary

End the PR body (or your final message) with:

```text
CHANGED:        <file>: <what and why>
NOT TOUCHED:    <related gap you noticed but left out of scope>
CONCERNS:       <assumptions the reviewer should confirm>
```

## Versioning

Release tags (`vX.Y.Z`) follow semver from the user's point of view: MAJOR = breaking (data migration users must act on, removed feature), MINOR = new capability, PATCH = fix. When unsure whether something is breaking, treat it as breaking.
