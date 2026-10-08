---
trigger: model_decision
description: Should be used when a GitHub issue is bound to the conversation context, or when starting/resuming work on a specific GitHub issue/backlog item
---

# Autonomous Implementation Workflow

Repository: `MikeDzossa/foodbiz-pwa`. Branch model: `develop` → `staging` → `main`. **Always branch from and open PRs against `develop`.**

When an agent picks up a GitHub issue, follow this pipeline end-to-end.
All GitHub operations use the `gh` CLI (repo `MikeDzossa/foodbiz-pwa`; run from the repo root so `gh` resolves it).

## 1. Fetch & Understand

```bash
gh issue view <number> --json title,body,labels,parent
```

- Read the issue fully (description, acceptance criteria, labels).
- Query graphify for relevant code: `graphify query "<issue summary>"`.
- Identify affected files and their dependencies.

## 2. Decision Gate

Check the issue labels:

| Label           | Action                                                             |
| --------------- | ------------------------------------------------------------------ |
| `needs-review`  | Create a plan artifact, wait for user approval before implementing |
| `design-change` | Create a plan artifact, wait for user approval before implementing |
| _(any other)_   | **Proceed autonomously** — no plan review needed                   |

If a plan is required, outline: scope, affected files, approach, risks. Stop and wait for explicit approval.

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
npm run test
npm run format:check
npm run build       # all must pass with zero errors
```

## 6. Pull Request

```bash
git push origin <branch-name>
gh pr create --base develop --title "feat(scope): description (#<number>)" --body "Closes #<number>

## Changes
- <summary of changes>

## Verification
- [x] lint, typecheck, tests, format:check and build pass"
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

Issues carry an `area:` label: `storefront`, `dashboard`, `orders`, `products`, `expenses`, `analytics`, `auth`, `infra`, `design-system`.

## Issue Hierarchy

This project uses GitHub sub-issues for epic → story tracking:

- **Epics** (`type: epic`): Feature domain groupings containing child stories
- **Stories** (`type: story`): Implementable user stories, children of an epic
- **Bugs** (`type: bug`): Bug fixes, children of the Maintenance epic

When creating a new story, always parent it to the relevant epic:

```bash
gh api repos/{owner}/{repo}/issues/<epic-number>/sub_issues \
  --method POST --field sub_issue_id=<story-number>
```
