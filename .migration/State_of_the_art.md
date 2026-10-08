# FoodBiz PWA: Agent Handoff

## 1. Context & Stack

The project is pivoting from a React Native (Expo) mobile app to a unified Progressive Web App (PWA). The repository `MikeDzossa/foodbiz-pwa` serves both the business manager dashboard and the customer storefront from a single codebase.

**Core Stack:**

- **Framework:** Next.js 16.4 (App Router, `cacheComponents: true`, Turbopack). `src/proxy.ts` handles Supabase session refreshes.
- **Language:** TypeScript 5 (strict). No `any`, no `const enum`.
- **Styling:** Tailwind CSS v4 tokens in `src/app/globals.css` `@theme`. `shadcn/ui` + lucide icons and the Inter font are decided but not installed yet (Phase 5).
- **Backend:** Supabase via `@supabase/ssr` (Postgres, Auth, Storage, RLS). Clients isolated in `src/lib/supabase/`. Development starts on in-memory mocks (`DATA_SOURCE=mock|supabase`); Supabase is integrated in wave 4.
- **Validation & Testing:** zod 4, Vitest + React Testing Library (jsdom). Tooling tests: Vitest (`vitest.tooling.config.mts`) + Python stdlib `unittest`.
- **Deployment:** Vercel (preview per PR; `develop` not deployed).

**Workflow Constraints:**

- **Branching:** `develop` → `staging` → `main`. Always branch from `develop`; all PRs target `develop`. Agents never merge PRs.
- **Local gate (before any PR):** `npm run format:check && npm run lint && npm run typecheck && npm run test:coverage && npm run test:tooling && npm run build`.
- **Agent workflow:** `.agents/rules/github_issue.md` (pick work → gate check → branch → implement → verify → PR).

## 2. Done So Far (Phases 1–4)

| Phase | Status | Delivered |
| --- | --- | --- |
| 1. Scaffold | ✅ PR #1 | Next.js 16 app, Vitest/Prettier, PWA manifest (`src/app/manifest.ts`), zod env config, Supabase SSR clients, web `.devcontainer` |
| 2. Docs & agents | ✅ PR #2, #13 | `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.agents/rules/` + `.agents/skills/`, `docs/` (architecture, functional spec, contributing, legacy Expo reference) |
| 3. CI/CD | ✅ PR #3 (+ Dependabot #4–#6) | `ci.yml` quality gate + PR comment report, `promote.yml`, `pr-title.yml`, Dependabot, PR template, `vercel.json`, `docs/DEPLOYMENT.md` |
| 4. Backlog & roadmap | ✅ PR #139 | Full GitHub backlog, issue tooling, review gates, coverage policy (details below) |

### Phase 4 outcome

**Backlog on GitHub** (source of truth; no backlog data in the repo):

- Milestones: `v0.9 MVP` (functional end-to-end app on Vercel staging) and `Backlog / v1.x`.
- 21 epics, 104 stories: E1–E18 for v0.9 (#14–#124), E19 Product sizes & menus (#125), E20 Post-MVP enhancements (#128), `Epic: Maintenance` (#138) parenting every bug.
- Labels: `type:`, `priority: P0–P3`, `status:` (planned → in-progress → in-review → completed, blocked), `area:` (11 areas incl. `customers`, `settings`), `wave: 1–5`, `gate: needs-review | design-change`.
- Delivery waves: **W1** foundation on mocks (E1 domain, E2 design system/shell/i18n, E3 mock session, E18 schema draft) → **W2** manager side on mocks → **W3** storefront on mocks → **W4** Supabase integration → **W5** hardening & release.

**Product decisions locked** (reflected in the issues):

- Single business for v0.9; every table carries `business_id`.
- Guest checkout only: guest = name + phone, unique per business (E.164); stored guest data is never echoed to the visitor.
- Orders: `NEW → CONFIRMED → PREPARING → READY → COMPLETED`, `CANCELLED` before completion; separate `paid` (`paid|unpaid`); an unpaid order cannot be completed.
- Payments: no online payment. Customer preference Revolut (revtag), Wero, or pay at pickup/delivery; the manager records the actual method (cash, Revolut, Wero) manually.
- Ordering: ASAP by default, optional date + optional time; opening hours optional (delivery/pickup-only businesses supported).
- Manager auth: Google sign-in; allow-list env var in dev/test only; production access via `business_members`.
- Locale: English default, French secondary; EUR only (currency change later).
- Design: Inter only (tabular figures), legacy palette as light/dark tokens, shadcn/ui, minimal motion (150–200 ms, reduced-motion aware), no decorative effects.
- "Coming soon" pattern: unimplemented features are visible, greyed with a "Soon" badge, **not disabled**; a tap shows a toast and logs `feature_interest`. Manager account & settings are complete in v0.9 using this pattern.
- Data: mocks first behind repository interfaces with a shared contract test suite; local Supabase (Docker) for DB/RLS tests (no SQLite).

**Agent tooling & quality gates:**

- `.agents/skills/issue-logger/scripts/gh_issue.py`: `create SPEC [--apply]` (epic/story/bug from JSON, dry run by default), `next -n N --type story|bug|all` (prioritised ready items; the user chooses features vs bugs), `setup` (labels/milestones). The issue-logger skill must use it.
- Review gates: `gate: needs-review` / `gate: design-change` → the agent posts a plan and waits for approval; otherwise it works autonomously.
- Coverage: production code only. Floors in `vitest.config.mts`: lines/functions/statements 70% (raised by `scripts/coverage-ratchet.mjs`, capped at 70%, never lowered), branches fixed at 80%. Small drops are fine while floors pass. Per-layer targets (Domain 85%, Features 80%, Config 80%, Lib 75%, Components 70%, App 70%) are reported in the CI comment, not enforced.
- Tooling (`scripts/`, `.github/.scripts/`, `.agents/skills/*/scripts/`) must have tests; tooling coverage target 60%, informative only.

## 3. Current State

- **Code:** still the Phase 1 scaffold (home page, manifest, env parsing, Supabase clients, session-refresh proxy). No `src/domain`, `src/features` or `src/components` yet. Production coverage: lines 90%, branches 100%, functions 75%.
- **Design:** spec written (`docs/design/`), not yet implemented in code. Fonts are still Geist; tokens in `globals.css` are minimal until #26/#27 land. Stitch project and light/dark design systems are in `docs/design/DESIGN_SYSTEM.md` §11; active screens in the `SCREENS.md` registry.
- **Open PRs:** Dependabot majors #7–#12 (actions/checkout v7, jsdom 30, `@types/node` 26, eslint 10, vitest 5, `@vitest/coverage-v8` 5). Review before Phase 6: keep `@types/node` aligned with the Node 22 runtime; upgrade vitest and its coverage provider together and re-run `test:coverage` and `test:tooling`.
- **Housekeeping:** this handoff lives on the local `temp` branch, not in `develop`.

## 4. Phase 5: Design System & Design Board (in progress)

**Objective:** a coherent, sustainable mobile-first UI/UX in **light and dark**, designed in Google Stitch (via MCP in Google Antigravity for VS Code) and implemented with project tokens and components, flow by flow.

**Agreed approach:**

- **Code tokens are the source of truth.** `docs/design/DESIGN_SYSTEM.md` specifies them; #26/#27 implement them in `globals.css`. Stitch mirrors them one-way through **two design systems (light, dark)** — Stitch supports one colour mode per design system. Token change = PR first, then `update_design_system` + `apply_design_system`.
- **Patterns reference first (F0).** One Stitch screen (light + dark) shows navigation, buttons, inputs, list row, KPI card, status pills, sheet, toast, empty/loading/error and the Soon pattern. Every later generation prompt says "use only patterns from the reference". A screen needing a new pattern adds it to F0 first.
- **Loop unit = one flow (1–3 related screens):** brief in `SCREENS.md` → generate in Stitch (light, then dark) and self-check → **owner approval** → rebuild with our components (one PR per story, `design-change` gate) → Playwright screenshots light/dark × EN/FR vs Stitch → board updated → `verified`. Shells go through the loop first.
- **Stitch HTML/Tailwind export is a visual reference only**, never pasted: it uses generic classes, hex values and its own icons, with no i18n, `data-testid` or shadcn.
- **Mobile-first, calm, functional:** one-thumb reach, 48 px targets, WCAG 2.2 AA, EN and FR (FR ~20–30 % longer), no decorative motion.

**Stitch MCP capabilities (verified 2026-10-09):** `create_project`, `list_screens`, `get_screen`; `create_design_system`, `update_design_system`, `list_design_systems`, `apply_design_system`, `upload_design_md` + `create_design_system_from_design_md`; `generate_screen_from_text` (MOBILE), `edit_screens`, `generate_variants`. Limits: AI generation (minutes, non-deterministic), no reusable components, palette from seed + primary/secondary/tertiary/neutral overrides, radius 4/8/12/full.

**Done:**

- `docs/design/DESIGN_SYSTEM.md` — principles, light/dark tokens with computed contrast, Inter type scale, spacing/radius/elevation/motion, layout and safe areas, icons, component inventory, Soon pattern, EN/FR tone, a11y checklist, Stitch mirror IDs.
- `docs/design/SCREENS.md` — every v0.9 screen mapped to stories and grouped into flows F0–F15.
- `AGENTS.md` rule 14 updated.
- Stitch project, light and dark design systems, F0 patterns reference (IDs in `DESIGN_SYSTEM.md` §11 and the `SCREENS.md` registry).

**Next:**

1. Owner review of F0 (light and dark) and the token spec.
2. Implement foundations, one PR per story: #26 tokens & themes, #27 Inter, #28 shadcn/ui primitives, #33 Soon pattern, #34 states, #31 i18n (settles routes).
3. Loop F1 manager shell (#29) and F2 storefront shell (#30), then F3… in `SCREENS.md` order.
4. Propose the living style guide story (dev-only route + Playwright screenshot script) with the issue-logger script (dry run).

## 5. Antigravity Prompt (Phase 5, per flow)

Paste into Google Antigravity chat; replace `<FLOW>` (e.g. `F1 Manager shell`). For foundation stories (#26–#34) use the normal issue workflow instead.

```text
Continue Phase 5 of foodbiz-pwa with flow <FLOW>.
Read first: AGENTS.md, .migration/State_of_the_art.md, docs/design/DESIGN_SYSTEM.md, docs/design/SCREENS.md, .agents/rules/github_issue.md and the frontend-ui-engineering skill. Read the flow's stories with `gh issue view`.

Stitch project and design-system IDs plus the Stitch working rules are in DESIGN_SYSTEM.md §11; active screen IDs are in the SCREENS.md registry. Follow the rules strictly: one generation per screen and mode, no retries, every new card recorded. Code tokens are the source of truth; never change tokens in Stitch only.

1. Brief. Add to SCREENS.md for each screen of the flow: user goal, content hierarchy, primary action, key states (empty, loading, error, flow-specific), EN and FR copy. Status → brief.
2. Design. For each screen call `generate_screen_from_text` with deviceType MOBILE, the LIGHT design system, the brief, and: "Use only the components and patterns from the patterns reference screen; tokens from DESIGN_SYSTEM.md; Inter with tabular figures; 48 px targets; status always shown with text; no gradients, illustrations or decorative imagery." Then generate the DARK version with the dark design system. Inspect both with `get_screen`; fix real defects with one batched `edit_screens` call, never a new generation. Report anything that needs a new pattern instead of inventing it. Update the SCREENS.md registry (active and superseded IDs); status → designed. [APPROVAL]
3. Implement after approval, one branch/PR per story (github_issue.md, design-change gate: post the plan first). Use the Stitch screenshot/HTML as a visual reference only; rebuild with our components and tokens; i18n strings, data-testid, Server Components by default. Status → implemented.
4. Verify: screenshots light/dark × EN/FR at mobile width compared with the Stitch frames, a11y checklist from DESIGN_SYSTEM.md, local gate. If the implementation intentionally differs, update the Stitch screens with `edit_screens`. Status → verified. Attach light/dark screenshots to the PR.
5. Report and propose the next flow; do not start it without my approval.

Rules: Tailwind tokens only (no hardcoded colours/px, no style props); WCAG 2.2 AA; prefers-reduced-motion respected; no dependencies beyond shadcn/ui, its Radix peers and lucide-react without asking; never merge PRs.
```
