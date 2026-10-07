---
name: issue-logger
description: Creates GitHub issues (epics, stories, bugs) from natural language chat descriptions. Formats input against repo templates, infers missing fields, prompts minimally, shows dry-run preview, and pushes only after explicit user confirmation. Use when the user says "new issue", "log issue", "create story", "create epic", "report bug", "add to backlog", or describes a feature/bug they want tracked.
---

# Issue Logger Skill

## Purpose

Convert a plain-text user description into a fully formatted GitHub issue (epic, story, or bug) following the project's issue templates, then push to GitHub only after explicit confirmation.

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
| Parent Epic | Infer from context (e.g., "product" → Inventory epic #19, "order" → Sales epic #23, "expense" → Expense epic #27, "dashboard" → Dashboard epic #12, "auth/login" → Auth epic #8, "settings" → Config epic #30, "navigation/shell" → Shell epic #1). If ambiguous, prompt with list of open epics. |
| Description | Convert to user story format: "As a <role>, I want <goal> so that <benefit>" |
| Acceptance Criteria | Extract testable criteria from description. If insufficient, prompt: "What specific criteria should we verify?" |
| Review Gate | Infer: visual changes → "design-change", complex multi-file → "needs-review", simple → "standard" |
| Technical Notes | Include any implementation hints from the description |
| Labels | `type: story`, `status: planned` |

#### For Bugs:
| Field | Source Strategy |
|-------|---------------|
| Title | "Bug: <concise summary>" |
| Bug Description | What happened vs what was expected |
| Steps to Reproduce | Extract from description. If missing, prompt. |
| Expected Behavior | Infer from context or prompt. |
| Severity | Infer: "crash"/"data loss" → Critical, "broken" → Major, "cosmetic" → Minor. Default: Major |
| Labels | `type: bug` |
| Parent Epic | Always #40 (Maintenance) |

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
   - Priority (default P2 for epics, skip for stories/bugs)
   - Review gate (infer from complexity)
   - Labels (auto-assigned)
   - Technical notes (optional, include only if user mentioned)

### Step 4 — Dry Run Preview

Present the formatted issue as a preview. Format it exactly as it will appear on GitHub:

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

### Review Gate
standard — agent implements autonomously

### Technical Notes
...
```

Then ask: **"Ready to push this to GitHub? (yes/no)"**

If the user says no or requests changes, revise and show preview again.

### Step 5 — Push to GitHub

Only after explicit "yes" / "confirm" / "push it" / "go ahead":

```bash
# Create the issue
gh issue create --title "<title>" --body "<body>" --label "type: story" --label "status: planned"

# If it's a story, parent it to the epic
gh api repos/{owner}/{repo}/issues/<epic-number>/sub_issues \
  --method POST --field sub_issue_id=<new-issue-number>
```

For epics with child stories:
1. Create the epic first
2. Create each child story
3. Parent each story to the epic
4. Update the epic body with the actual issue numbers

### Step 6 — Confirm Success

Report back:
```
✅ Created Story #<number>: <title>
   ↳ Parented to Epic #<parent>: <epic-title>
   🏷️ Labels: type: story, status: planned
```

## Epic-to-Story Mapping Reference

Use this to auto-assign parent epics:

| Keywords in description | Parent Epic |
|------------------------|-------------|
| navigation, tab, drawer, shell, layout, screen container | #1 — Application Shell |
| auth, login, sign-in, OAuth, security, biometric | #8 — Authentication & Security |
| dashboard, KPI, widget, recent activity, chart, analytics, graph | #12 — Dashboard & Analytics |
| product, inventory, stock, catalog, category | #19 — Inventory & Product Management |
| order, checkout, cart, receipt, delivery, status | #23 — Sales & Order Fulfillment |
| expense, cost, purchase, bill, supplier | #27 — Expense & Financial Tracking |
| settings, config, currency, theme, backup, sync, cloud | #30 — System Configuration |
| bug, fix, regression, broken, crash | #40 — Maintenance |

## Batch Mode

If the user provides multiple issues at once (e.g., "create stories for X, Y, Z"), process them all:
1. Show a single consolidated preview with all issues
2. Push all after single confirmation
3. Handle parenting for each

## Error Handling

- If `gh` CLI fails, report the error and suggest manual creation
- If parent epic doesn't exist, ask user which epic to use
- If sub-issue API fails, fall back to adding `Parent: #<number>` in the body text
