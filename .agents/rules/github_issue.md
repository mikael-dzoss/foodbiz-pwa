---
trigger: model_decision
description: Should be used when a GitHub issue is bound to the conversation context, or when starting/resuming work on a specific GitHub issue/backlog item
---

# Autonomous Implementation Workflow

Repository: `MikeDzossa/foodbiz-pwa`. Branch model: `develop` → `staging` → `main`. **Always branch from and open PRs against `develop`.**

When an agent picks up a GitHub issue, follow this pipeline end-to-end.
All GitHub operations use the `gh` CLI (repo `MikeDzossa/foodbiz-pwa`; run from the repo root so `gh` resolves it).

## 0. Pick Work ("implement the next N items")

```bash
python3 -B .agents/skills/issue-logger/scripts/gh_issue.py next -n <N> --type story   # features (default)
python3 -B .agents/skills/issue-logger/scripts/gh_issue.py next -n <N> --type bug     # bugs
python3 -B .agents/skills/issue-logger/scripts/gh_issue.py next -n <N> --type all     # both, by priority
```

Use the type the user asked for ("next N features/stories" → `story`, "next N bugs" → `bug`). If the user just says "next N items" and ready bugs exist, ask which type before starting. Stories are ordered by `wave`, `priority`, issue number (milestone `v0.9 MVP` by default); bugs by `priority`, issue number; `all` by `priority` first. Epics and `status: in-progress|in-review|blocked|completed` are excluded. Take items **in that order**, one branch/PR per issue. Stop at the first gated item (`gate:` label) and present its plan; continue only after approval. To create issues, use the `issue-logger` skill (never raw `gh issue create`).

## 1. Fetch & Understand

```bash
gh issue view <number> --json title,body,labels,parent
```

- Read the issue fully (description, acceptance criteria, labels).
- Query graphify for relevant code: `graphify query "<issue summary>"`.
- Identify affected files and their dependencies.

## 2. Decision Gate

Check the issue labels:

| Label                 | Action                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------- |
| `gate: needs-review`  | Post a plan (scope, files, approach, risks) and wait for user approval                  |
| `gate: design-change` | Post a plan plus UI proposal (screens/states, light & dark) and wait for user approval  |
| _(no `gate:` label)_  | **Proceed autonomously** — no plan review needed                                        |

Also stop and ask if acceptance criteria are ambiguous, the issue depends on an unmerged item, or the change needs a new dependency, secret, env var, migration on shared data or service-role usage. The PR review by a maintainer, CI, and promotion to `staging`/`main` remain human gates for every issue.

## 3. Branch & Update Status

```bash
git checkout develop && git pull origin develop
git checkout -b <github-username>/issue-<number>
```

Immediately mark the issue as in-progress:

```bash
gh issue edit <number> --remove-label "status: planned" --remove-label "status: proposed" --add-label "status: in-progress"
```

## 4. Implement

- Follow ponytail: simplest solution that actually works.
- Use `graphify query` and `graphify path` to understand code before editing.
- Commit incrementally with descriptive messages:
  ```
  feat(orders): add status filter pills (#42)
  fix(dashboard): correct KPI profit calculation (#38)
  ```
- Run `npm run typecheck` (and `npm run lint`) after each logical change to catch errors early.

## 5. Verify

```bash
npm run lint
npm run typecheck
npm run test:coverage   # tests + coverage floors + ratchet
npm run test:tooling    # agent/CI tooling tests (Python)
npm run format:check
npm run build       # all must pass with zero errors
```

**Coverage must not decrease.** `vitest.config.mts` holds global coverage floors; `test:coverage` fails below them, then `scripts/coverage-ratchet.mjs` raises lines/functions/statements toward actual coverage (capped at 70%; branches fixed at 80%) — commit the updated config. Coverage counts production code only (see `coverage.exclude`). Never lower thresholds, add coverage excludes, or skip tests to pass; if a change cannot keep coverage, stop and ask. Agents never merge PRs; merging is done by a maintainer.

Per-layer targets above the global floor (reported in the CI PR comment by `.github/.scripts/generate-ci-comments.js`, not enforced yet): Domain 85%, Features 80%, Config 80%, Lib 75%, Components 70%, App 70%. Aim for them and mention gaps in the PR.

Core tooling (`scripts/`, `.github/.scripts/`, `.agents/skills/*/scripts/`) must have tests; changes to it update those tests.

## 6. Pull Request

```bash
git push origin <branch-name>
gh pr create --base develop --title "feat(scope): description (#<number>)" --body "Closes #<number>

## Changes
- <summary of changes>

## Verification
- [x] lint, typecheck, test:coverage (no coverage decrease), format:check and build pass"
```

## 7. Update Issue

```bash
gh issue edit <number> --remove-label "status: in-progress" --add-label "status: in-review"
gh issue comment <number> --body "PR created: <pr-url>"
```

## 8. Post-Merge

After PR is merged:

```bash
gh issue edit <number> --remove-label "status: in-review" --add-label "status: completed"
gh issue close <number>
```

Run `graphify update .` to keep the knowledge graph current.

## Areas

Issues carry an `area:` label: `storefront`, `dashboard`, `orders`, `products`, `expenses`, `analytics`, `auth`, `infra`, `design-system`, `customers`, `settings`.

## Issue Hierarchy

This project uses GitHub sub-issues for epic → story tracking:

- **Epics** (`type: epic`): Feature domain groupings containing child stories
- **Stories** (`type: story`): Implementable user stories, children of an epic
- **Bugs** (`type: bug`): Bug fixes, children of the Maintenance epic

Create issues with the `issue-logger` skill script (`.agents/skills/issue-logger/scripts/gh_issue.py`); it handles parenting, labels and milestones.
