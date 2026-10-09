---
trigger: model_decision
description: Use when picking up, implementing, resuming or merging work for a GitHub issue ("implement issue #N", "next N items")
---

# Issue → PR Workflow

Repo `MikeDzossa/foodbiz-pwa`; run `gh` from the repo root. Branch names, commit/PR format and the validation gate are defined in [CONTRIBUTING.md](../../docs/CONTRIBUTING.md#branches) — follow them, don't restate them.

## 0. Pick Work ("implement the next N items")

```bash
python3 -B .agents/skills/issue-logger/scripts/gh_issue.py next -n <N> --type story|bug|all
```

"next N features/stories" → `story` (default); "next N bugs" → `bug`; plain "next N items" while ready bugs exist → ask which type. The script returns items in execution order (milestone `v0.9 MVP` by default; epics and `status: in-progress|in-review|blocked|completed` excluded). Take them in that order, one branch/PR per issue. Stop at the first gated item and present its plan.

### Grouping Small Related Stories
Small related stories under the same parent epic (< 200 lines each) may be grouped into a single branch/PR as long as total lines stay within `2 × threshold` (≤ 400 lines). Maintenance issues (`type: bug`) are never grouped and must remain isolated.
To inspect open ready sibling stories under the same parent epic:
```bash
python3 -B .agents/skills/issue-logger/scripts/gh_related_issues.py [<number>]
```
Work locally without pushing to remote until grouping finishes or stops, then push and open the PR referencing all closed issues (`Closes #A`, `Closes #B`).

## 1. Understand

`gh issue view <number> --json title,body,labels,parent`. Read description, acceptance criteria (AC) and labels; locate affected code with `graphify query "<issue summary>"`.

## 2. Gate

| Label                 | Action                                                                     |
| --------------------- | -------------------------------------------------------------------------- |
| `gate: needs-review`  | Post a plan (scope, files, approach, risks); wait for approval              |
| `gate: design-change` | Plan + UI proposal (screens/states, light & dark); wait for approval        |
| _(none)_              | Proceed autonomously                                                       |

Also stop and ask if AC are ambiguous, the issue depends on an unmerged item, or the change needs a new dependency, secret, env var, migration on shared data or service-role usage.

## 3. Branch & Status

```bash
git switch develop && git pull origin develop
git switch -c feature/<number>-<slug>   # bug/<number>-<slug> for bugs
gh issue edit <number> --remove-label "status: planned" --add-label "status: in-progress"
```

## 4. Implement

Simplest solution that works (ponytail). Commit each working slice. Run `npm run typecheck` after each logical change. Add or update tests for every behaviour change.

## 5. Verify

Run the full [validation gate](../../docs/CONTRIBUTING.md#validation-gate) and commit any thresholds raised by the ratchet. If the floors can't be met, stop and ask.

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

The `Closes #<number>` keyword closes the issue on merge and the `Issue status` workflow sets `status: completed`; don't do either by hand.
