---
name: ship
description: Plan, implement, verify, review and merge work for this repo, as one PR or a gh stack of PRs. Use when picking up or implementing issues ("next N items", "implement #N"), batching stories, opening or restacking PRs, or merging your own PR into develop.
---

# Ship

Branches, commit and PR formats: [CONTRIBUTING.md](../../../docs/CONTRIBUTING.md#branches). Repo `mikael-dzoss/foodbiz-pwa`; run `gh` from the repo root. Agents plan, implement, verify locally, push once, self-review, and merge their own PRs into `develop`. Safety comes from the automated checks, not from waiting for the owner. CI minutes are scarce (private repo, free plan): every push to a PR re-runs CI, so spend effort locally first.

## 1. Pick work

```bash
S=.agents/skills/issue-logger/scripts/gh_issue.py
python3 -B $S next -n 5 --type bug      # bugs first
python3 -B $S next -n 5 --type story    # then by wave and priority
```

Take items in that order. Stories sharing a parent epic: `gh_related_issues.py <number>`. An explicit user request overrides the order.

## 2. Read and plan

`gh issue view <n> --json title,body,labels,parent`; locate code with `graphify query "<summary>"`. Write a short plan (approach, slices, risks) into the PR description; do not wait for approval. UI work follows [design.instructions.md](../../rules/design.instructions.md). Stop only for the cases in section 8.

## 3. Slice

You choose the slices. A good slice is coherent, reviewable and independently revertible. A slice may cover several stories and a story may span several slices. There are no line, file or story limits.

- Small or tightly coupled work: one branch, one PR (`Closes #A`, `Closes #B`).
- Large or layered work (schema, then domain, then UI): a `gh stack`, one PR per slice. Lower slices must not depend on higher ones.
- Unrelated work: separate branches off `develop`, or separate worktrees ([git-workflow-and-versioning](../git-workflow-and-versioning/SKILL.md#parallel-agents-worktrees)). Never two agents on one branch.

Branch `<feature|bug|utils>/<number>-<slug>` off a fresh `origin/develop`. Bug-fix PRs carry the `bug` label.

## 4. Implement

Simplest thing that works ([ponytail](../ponytail/SKILL.md)); tests first for behaviour changes ([test-driven-development](../test-driven-development/SKILL.md)). Commit each working slice with a conventional message that ends with the repo's commit attribution line.

## 5. Verify locally, then push once

`npm run gate` runs only the tiers your diff needs (format, lint, typecheck, unit tests with coverage; plus tooling, integration and e2e when relevant). Fix everything before the first push. `npm run gate:quick` while iterating, `npm run gate:full` for a risky change. The integration tier (pgTAP, live tests, `build:local`, Supabase journey) needs local Supabase (`npm run db:start`); the gate prints the commands if it is down. CI runs the same tiers from the same scope rules ([CI tiers and cost](../../../docs/CONTRIBUTING.md#ci-tiers-and-cost)).

Economy rules:

- Never push to "see what CI says". CI only confirms what the gate already proved.
- Push a whole stack once. Batch review fixes into one push per PR.
- On a CI failure, reproduce it locally with `npm run gate` before touching anything, then fix and push once.
- Do not restack unless a lower PR changed.
- Set a PR's title and body in one call (`gh pr create`, or one `gh pr edit --title --body-file`): every title or body edit re-runs CI.
- In a stack, CI runs only the cheap `check` tier on middle PRs; the bottom PR (base `develop`) and the top PR carry the expensive tiers. Merge with `gh stack merge`; the one required check is `Quality Gate - Summary`.

## 6. Open the PR

Single PR:

```bash
git push -u origin <branch>
gh pr create --base develop --title "<type>(<scope>): <description> (#<n>)" --body-file <file>
```

Fill the [PR template](../../../.github/pull_request_template.md). Add the plan, `Closes #<n>` per issue, each acceptance criterion with how it was verified, and what you opened in a browser.

Stack (`gh stack`, checked against `gh stack --help` v0.3.0; trunk is `develop`):

```bash
git fetch origin
gh stack init --base develop <branch-1>      # creates the first layer branch
# commit slice 1, then for each further layer:
gh stack add <branch-2>                      # new branch on top; or gh stack add -Am "<msg>" <branch-2>
gh stack submit --auto --open               # one atomic push of every branch, creates the PRs and the stack
gh pr edit <pr> --title "<conventional title (#n)>" --body-file <file>   # per PR
gh stack view --short                        # confirm membership
```

Each stacked PR body starts with `> **Stacked PR**: base is <parent>, part of stack #<n>.` Resume with `gh stack checkout <stack-number>`. `gh stack push|submit|sync` force-push with `--force-with-lease` internally.

Lower layer needs a fix: `gh stack checkout <lower-branch>`, commit, `npm run gate`, `gh stack rebase --upstack`, `gh stack push`. If `develop` moved and you must update: `gh stack rebase` then `gh stack push`. Conflicts: resolve, `git add`, `gh stack rebase --continue` (`--abort` restores).

## 7. Review, then merge

Run the matching reviewer subagents ([.claude/agents](../../../.claude/agents)) and fix their findings before merging; commit all fixes, then push once:

- `security-reviewer`: auth, sessions, env or secrets, Server Actions, proxy.
- `migration-reviewer`: anything in `supabase/migrations/`.
- `ui-reviewer`: any `.tsx` change.

Merge your own PR into `develop` once required checks pass (`gh pr checks <pr> --watch`). If the repo has auto-merge enabled, `gh pr merge <pr> --auto --merge --delete-branch`; otherwise merge when the watch exits 0:

```bash
gh pr merge <pr> --merge --delete-branch      # single PR
gh stack merge <top-pr> --merge --yes         # stack: merges that PR and everything below it, bottom first
gh stack sync --prune                         # afterwards: fast-forward develop, prune merged branches
```

Never merge into `staging` or `main`; promotion belongs to the owner ([DEPLOYMENT.md](../../../docs/DEPLOYMENT.md#releasing)). `Closes #<n>` closes the issue and the `Issue status` workflow marks it `status: completed` (and the epic when all children are done). Do not do either by hand.

## 8. Stop and ask the owner only for

- Anything that costs money or needs a new third-party account or secret.
- Destructive or irreversible operations on hosted data or infrastructure, secret rotation, history rewrites, visibility changes.
- Behaviour that differs from [FUNCTIONAL_SPECIFICATION.md](../../../docs/FUNCTIONAL_SPECIFICATION.md).
- Milestone scope changes, closing or rewriting existing issues.
- Brand identity.

Batch the questions in one message and keep working on whatever does not depend on the answers.

## Definition of done (per PR)

- Acceptance criteria met and ticked in the PR body with how each was verified.
- `npm run gate` green locally and CI green.
- Changed screens opened in a browser at mobile (360 px) and desktop widths, in EN and FR, light and dark.
- Docs updated; reviewer subagent findings fixed.
