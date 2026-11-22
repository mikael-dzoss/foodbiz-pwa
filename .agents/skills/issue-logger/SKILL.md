---
name: issue-logger
description: Creates GitHub issues (epics, stories, bugs) from natural language chat descriptions. Formats input against repo templates, infers missing fields, prompts minimally, shows dry-run preview, and pushes only after explicit user confirmation. Use when the user says "new issue", "log issue", "create story", "create epic", "report bug", "add to backlog", or describes a feature/bug they want tracked.
---

# Issue Logger Skill

## Purpose

Convert a plain-text user description into a fully formatted GitHub issue (epic, story, or bug) following the project's issue templates, then push to GitHub only after explicit confirmation.

## Tooling (mandatory)

All issue creation goes through `.agents/skills/issue-logger/scripts/gh_issue.py` (stdlib Python, wraps `gh`). Never call `gh issue create` directly: the script enforces the templates, labels (`type`, `status`, `priority`, `area`, `wave`), milestone, sub-issue parenting and the epic's child checklist.

```bash
S=.agents/skills/issue-logger/scripts/gh_issue.py
python3 -B $S create spec.json            # dry run: prints the exact preview
python3 -B $S create spec.json --apply    # creates on GitHub (only after user confirmation)
echo '<json>' | python3 -B $S create -    # spec from stdin
python3 -B $S next -n 5                   # prioritized ready items
python3 -B $S setup                       # sync labels/milestones (rarely needed)
```

### Spec format (JSON object, or array for batch)

```jsonc
// Epic (stories optional; nested stories get parented automatically)
{ "type": "epic", "title": "Loyalty", "description": "…", "priority": "P2", "area": "customers",
  "milestone": "v0.9 MVP", "stories": [ { "type": "story", "title": "…", "description": "…", "ac": ["…"],
  "priority": "P2", "area": "customers", "wave": 5 } ] }
// Story
{ "type": "story", "parent": 48, "title": "…", "description": "As a manager, I want … so that ….",
  "ac": ["…", "…"], "priority": "P1", "area": "orders", "wave": 3,
  "notes": "optional", "milestone": "v0.9 MVP" }
// Bug (parented to the open "Epic: Maintenance" automatically)
{ "type": "bug", "title": "…", "description": "what happened vs expected", "steps": ["…"], "expected": "…",
  "severity": "critical|major|minor", "area": "orders", "browser": "Chrome (Android)" }
```

- `area`: storefront, dashboard, orders, products, expenses, analytics, auth, infra, design-system, customers, settings.
- `milestone`: `v0.9 MVP` (default), `Backlog / v1.x`, or `null`.
- Bug priority is derived from severity (critical→P0, major→P1, minor→P2) unless `priority` is given.
- Story `priority` and `wave` are required in the spec: copy them from the parent epic unless the user says otherwise (`gh issue view <epic> --json labels`).

## Workflow

### Step 1 — Classify Issue Type

From the user's description, determine the issue type:

| Signal | Type |
|--------|------|
| Groups multiple features, broad capability | **Epic** |
| "As a user, I want…", single implementable feature | **Story** |
| "broken", "crash", "regression", "doesn't work" | **Bug** |
| Ambiguous | Ask: "Is this an epic, story, or bug?" |

### Step 2 — Extract & Infer Fields

Parse the user's description to extract as many fields as possible **before** prompting for anything.

#### For Epics:
| Field | Source Strategy |
|-------|---------------|
| Title | Derive from description — concise domain label |
| Description | What business capability does this epic deliver? |
| Child Stories | If user mentions sub-features, create them as separate story issues. If none mentioned and this is NOT a "Maintenance" epic, prompt: "Every epic needs at least one story. What's the first story?" |
| Priority | Infer from urgency language (P0-P3). Default: P2 |
| Labels | `type: epic`, `status: planned` |

#### For Stories:
| Field | Source Strategy |
|-------|---------------|
| Title | Derive from description |
| Parent Epic | Infer from context by querying open issues labeled `type: epic`. If ambiguous, prompt the user with a list of open epics. |
| Description | Convert to user story format: "As a <role>, I want <goal> so that <benefit>" |
| Acceptance Criteria | Extract testable criteria from description. If insufficient, prompt: "What specific criteria should we verify?" |
| Technical Notes | Include any implementation hints from the description |
| Priority / Wave | Copy from parent epic labels unless urgency language says otherwise |
| Labels | Auto-assigned by the script (`type`, `status`, `priority`, `area`, `wave`) |

#### For Bugs:
| Field | Source Strategy |
|-------|---------------|
| Title | "Bug: <concise summary>" |
| Bug Description | What happened vs what was expected |
| Steps to Reproduce | Extract from description. If missing, prompt. |
| Expected Behavior | Infer from context or prompt. |
| Severity | Infer: "crash"/"data loss" → Critical, "broken" → Major, "cosmetic" → Minor. Default: Major |
| Labels | Auto-assigned by the script (`type: bug`, priority from severity, `area`) |
| Parent Epic | Automatic: the script parents bugs to the open `Epic: Maintenance`. |

### Step 3 — Optimize Prompting

**Core principle: prompt as little as possible.**

1. First, attempt to fill ALL fields from the description alone.
2. Batch any remaining required questions into a SINGLE prompt (don't ask one at a time).
3. Required prompts (cannot skip):
   - **Story**: Acceptance criteria if not deducible from description
   - **Story**: Parent epic if not inferrable
   - **Epic**: At least one child story if not a maintenance epic
   - **Bug**: Steps to reproduce if not described
4. Never prompt for:
   - Priority (default P2 for epics, inherit epic for stories, severity for bugs)
   - Labels (auto-assigned)
   - Technical notes (optional, include only if user mentioned)

### Step 4 — Dry Run Preview

Write the spec and run the script **without** `--apply`; show its output to the user. It renders exactly what will appear on GitHub, e.g.:

```markdown
## 📋 Issue Preview — [Epic|Story|Bug]

**Title:** <title>
**Labels:** `type: story`, `status: planned`
**Parent Epic:** #<number> — <epic title>

---

### Parent Epic
#<number>

### Description
As a <role>, I want <goal> so that <benefit>

### Acceptance Criteria
- [ ] AC1: ...
- [ ] AC2: ...

### Technical Notes
...
```

Then ask: **"Ready to push this to GitHub? (yes/no)"**

If the user says no or requests changes, revise and show preview again.

### Step 5 — Push to GitHub

Only after explicit "yes" / "confirm" / "push it" / "go ahead", re-run the same spec with `--apply`. The script creates the issue(s), parents stories/bugs as sub-issues, appends them to the parent epic's child checklist and wave labels, and skips titles that already exist (safe to re-run).

### Step 6 — Confirm Success

Report back:
```
✅ Created Story #<number>: <title>
   ↳ Parented to Epic #<parent>: <epic-title>
   🏷️ Labels: type: story, status: planned
```

## Epic-to-Story Mapping Reference

Use this to auto-assign parent epics:

| Keywords in description | Expected Epic Domain |
|------------------------|----------------------|
| navigation, shell, layout | Application Shell |
| auth, login, sign-in, security | Authentication & Security |
| dashboard, KPI, widget, chart, analytics | Dashboard & Analytics |
| product, inventory, stock, catalog | Inventory & Product Management |
| order, checkout, cart, receipt, delivery | Sales & Order Fulfillment |
| expense, cost, purchase, supplier | Expense Tracking |
| storefront, customer, seo, public catalog | Customer Storefront |
| settings, config, currency, theme | System Configuration |
| bug, fix, regression, broken | Maintenance |

*(Note: Always query GitHub for the actual issue ID of the corresponding epic in this repository using `gh issue list --label "type: epic"` before assigning).*

## Batch Mode

If the user provides multiple issues at once (e.g., "create stories for X, Y, Z"), process them all:
1. Show a single consolidated preview with all issues
2. Push all after single confirmation
3. Handle parenting for each

## Error Handling

- If the script reports `Invalid spec`, fix the listed fields (or ask the user) and dry-run again
- If `gh` fails, report the error and suggest manual creation
- If parent epic doesn't exist, ask user which epic to use
- Sub-issue link failures are printed with `!`; the body still contains `### Parent Epic #<n>`
