---
name: planning-and-task-breakdown
description: Breaks a product need into an epic with granular, vertically sliced stories and logs them via issue-logger. Use when the user describes a new capability, asks to "plan", "break down", "scope" or "create an epic", or when an issue is too large for one PR.
---

# Planning and Task Breakdown

Output is GitHub issues, never local plan files. The breakdown is logged with the [`issue-logger`](../issue-logger/SKILL.md) skill (one epic spec with nested stories, dry run, apply only after user confirmation).

## 1. Understand (read-only)

- Read the need and the relevant parts of [FUNCTIONAL_SPECIFICATION.md](../../../docs/FUNCTIONAL_SPECIFICATION.md#5-core-business-rules) (rules, domain model), [SCREENS.md](../../../docs/design/SCREENS.md#flows) (existing flows) and the code (`graphify query "<need>"`).
- List open epics (`gh issue list --label "type: epic" --state open`) to avoid duplicates; extend an existing epic instead of creating a parallel one.
- Write down unknowns. Ask the user once, batched, only for what changes the breakdown.

## 2. Slice vertically

Each story is one user-visible behaviour, end to end (migration + RLS + domain + action + UI + tests), not a layer.

```text
Bad:  "Orders schema" → "Orders actions" → "Orders UI"
Good: "Manager creates an order" → "Manager filters orders by status" → "Customer sees order status"
```

Exceptions: a shared foundation (e.g. the first migration of a new table, a new design-system component) may be its own story when several stories depend on it; put it in the earliest wave.

## 3. Size each story

A story is one clear behaviour with 3–5 acceptance criteria in one subsystem. Split when the title needs "and", when it spans unrelated areas, or when the AC list keeps growing. There is no file or line limit: the agent that ships it decides how to slice PRs (see the [`ship`](../ship/SKILL.md) skill).

## 4. Write each story

Map onto the issue-logger story spec:

| Spec field    | Content                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `description` | "As a <manager/customer>, I want <goal> so that <benefit>."                                                                              |
| `ac`          | Specific, testable outcomes incl. empty/error states, RLS (who must *not* see it), light & dark, EN/FR where UI is involved              |
| `wave`        | Execution order: dependencies in earlier waves; high-risk stories early                                                                    |
| `priority`    | Inherit the epic's unless the user says otherwise                                                                                          |
| `area`        | One area per story; a story needing two areas is usually two stories                                                                       |
| `notes`       | Dependencies (`Depends on: <story title or #N>`), files likely touched, open risks                                                         |

## 5. Present, then log

1. Show the breakdown as a short table (wave, title, depends on) plus open questions and risks.
2. On approval, build one epic spec with nested `stories` and run the issue-logger dry run; apply only after explicit confirmation.

## Red flags

- Layer-sliced stories ("all the schema", "all the UI").
- A story without testable AC, or AC that only say "works".
- Dependencies not reflected in `wave` order.
- A new epic that duplicates an open one.
