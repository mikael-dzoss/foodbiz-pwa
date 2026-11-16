---
name: implement-issue
description: Issue → branch → PR → merge workflow for this repo (pick next work, gate labels, status labels, PR body, merge rules). Use when picking up, implementing, resuming or merging work for a GitHub issue ("implement issue #N", "next N items", "next N bugs").
---

# Issue → PR Workflow

Repo `mikael-dzoss/foodbiz-pwa`; run `gh` from the repo root. Branch names, commit/PR format and the validation gate are defined in [CONTRIBUTING.md](../../../docs/CONTRIBUTING.md#branches) — follow them, don't restate them.

## 0. Pick Work ("implement the next N items")

```bash
python3 -B .agents/skills/issue-logger/scripts/gh_issue.py next -n <N> --type story|bug|all
```

"next N features/stories" → `story` (default); "next N bugs" → `bug`; plain "next N items" while ready bugs exist → ask which type. The script returns items in execution order (milestone `v0.9 MVP` by default; epics and `status: in-progress|in-review|blocked|completed` excluded). Take them in that order, one branch/PR per issue. For standalone issues, stop at a gated item and present its plan; when building a PR stack, plan all stack items upfront, implement the full chain in a dedicated GitHub stack (`gh stack`), and stop **merging** at the first review gate (merging up to the last PR before the first gated PR).

### Grouping Small Related Stories
Small related stories under the same parent epic may be grouped into a single branch/PR as long as total production code lines stay within the recommended limit (recommended ≤ ~2000 lines; not a hard limit and may be exceptionally bypassed for tightly coupled changes). Maintenance issues (`type: bug`) are never grouped and must remain isolated.
To inspect open ready sibling stories under the same parent epic:
```bash
python3 -B .agents/skills/issue-logger/scripts/gh_related_issues.py [<number>]
```
Work locally without pushing to remote until grouping finishes or stops, then push and open the PR referencing all closed issues (`Closes #A`, `Closes #B`).

For broader requirements, larger stories, or multi-step dependencies, construct a dedicated GitHub pull request stack (`gh stack`) instead of grouping or pausing implementation between stories. See the full decision framework, upfront stack planning, `gh stack` commands, and stack merge rules in [`stacked-pr-workflow`](../stacked-pr-workflow/SKILL.md).

## 1. Understand

`gh issue view <number> --json title,body,labels,parent`. Read description, acceptance criteria (AC) and labels; locate affected code with `graphify query "<issue summary>"`.

## 2. Gate

| Label                 | Action (Standalone Issue)                                                  | Action (In a PR Stack)                                                                 |
| --------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `gate: needs-review`  | Post a plan (scope, files, approach, risks); wait for approval             | Plan upfront with the stack, implement in the stack, and stop **merging** before this PR |
| `gate: design-change` | Plan + UI proposal (mobile Light Stitch model); wait for approval          | Plan + UI proposal upfront, implement in the stack, and stop **merging** before this PR  |
| _(none)_              | Proceed autonomously                                                       | Implement in stack and merge as part of the contiguous ungated prefix                  |

Also stop and ask if AC are ambiguous, the issue depends on an unmerged item, or the change needs a new dependency, secret, env var, migration on shared data or service-role usage.

## 3. Branch & Status

```bash
git switch develop && git pull origin develop
git switch -c feature/<number>-<slug>   # bug/<number>-<slug> for bugs
gh issue edit <number> --remove-label "status: planned" --add-label "status: in-progress"
python3 -B .agents/skills/issue-logger/scripts/gh_parent_issue.py <number> --set-in-progress
```

## 4. Implement

Simplest solution that works (ponytail). If the issue introduces or modifies a user-facing screen ([SCREENS.md](../../../docs/design/SCREENS.md)), apply [design.instructions.md](../../rules/design.instructions.md) to inspect or generate the mobile Stitch canvas first before writing UI code. Commit each working slice. Run `npm run typecheck` after each logical change. Add or update tests for every behaviour change.

## 5. Verify

Run the full [validation gate](../../../docs/CONTRIBUTING.md#validation-gate) and commit any thresholds raised by the ratchet. If the floors can't be met, stop and ask.

## 6. Pull Request

```bash
git push -u origin <branch>
gh pr create --base develop --title "<type>(<scope>): <description> (#<number>)" --body "Closes #<number>

## Changes
- <summary>

## Acceptance criteria
- [x] <each AC from the issue> — <how it was verified>

## Verification
- [x] Validation gate passes"
gh issue edit <number> --remove-label "status: in-progress" --add-label "status: in-review"
```

> [!IMPORTANT]
> **Bug Label Requirement**: Every bug fix PR (`fix(...)` / `bug/<number>-<slug>`) **must** carry the `bug` label. Pass `--label "bug"` upon PR creation, or attach it immediately with `gh pr edit <pr> --add-label "bug"`. Never ship a bug fix PR without the `bug` label.

## 7. Merge (agent)

Merge your own PR only when **all** hold; otherwise leave it for a maintainer and say why:

- Base is `develop` (never `staging`/`main`; promotions are human-only).
- The issue has no `gate:` label.
- `vitest.config.mts` defines coverage thresholds.
- `gh pr checks <pr> --required --watch` exits 0.
- Every AC is ticked in the PR body with its verification.

```bash
gh pr merge <pr> --merge --delete-branch
```

For stacked PRs, follow the stack merge strategy in [`stacked-pr-workflow`](../stacked-pr-workflow/SKILL.md#6-merging-a-stack--review-gate-discipline): ensure all PRs are linked in a dedicated GitHub stack (`#<stack-number>`), verify quality checks pass, and merge the last ungated PR before the first review gate (`PR_pre_gate`) in a single operation with `gh stack merge <PR_pre_gate> --merge --yes` (which automatically merges all PRs below it and rebases/retargets the remaining stack onto `develop`), followed by `gh stack sync --prune`.

The `Closes #<number>` keyword closes the issue on merge and the `Issue status` workflow sets `status: completed`. When all child stories of a parent epic are done, the workflow automatically sets the epic to `status: completed` and closes it. Don't do either by hand.
To manually sync an epic or scan all epics:
```bash
python3 -B .agents/skills/issue-logger/scripts/gh_parent_issue.py <number> --sync
python3 -B .agents/skills/issue-logger/scripts/gh_parent_issue.py --sync-all
```
