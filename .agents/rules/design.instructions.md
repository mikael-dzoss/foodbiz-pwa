---
trigger: glob
globs: "**/src/app/**/*.tsx, **/src/features/**/components/**, **/src/components/**, **/docs/design/**"
paths:
  - "src/app/**/*.tsx"
  - "src/features/**/components/**"
  - "src/components/**"
  - "docs/design/**"
description: Autonomous Stitch mobile canvas flow for screens from SCREENS.md
---

# Design & Stitch Canvas Rules

Every user-facing screen/modal sheet must exist on the Stitch mobile canvas before being implemented in code.

## 1. Single Sources of Truth

- **Screen briefs & active canvas registry:** [`SCREENS.md`](../../docs/design/SCREENS.md)
- **Stitch Project & MCP setup:** [`DESIGN_SYSTEM.md`](../../docs/design/DESIGN_SYSTEM.md) (§11 Stitch mirror)
- **Design tokens:** [`DESIGN_SYSTEM.md`](../../docs/design/DESIGN_SYSTEM.md) (§2 colour tokens)
- **Components & patterns:** [`COMPONENTS.md`](../../docs/design/COMPONENTS.md) and [`/patterns`](../../src/app/patterns/page.tsx)

## 2. Autonomous Workflow

When implementing or redesigning any screen from `SCREENS.md`:

1. **Check Canvas**:
   - If an active Light screen ID already exists in `SCREENS.md`, inspect it with `get_screen` as the visual model.
   - If missing (or undergoing a major redesign), generate it in Stitch.
2. **Generate in Stitch (Mobile only)**:
   - Always set `deviceType: MOBILE` — never generate desktop cards in Stitch.
   - Only the **Light mode** Stitch design (`assets/14358508387441273017`) is allowed via `generate_screen_from_text`.
   - **Generation of dark theme models in Stitch is strictly banned.** Dark mode styling is derived automatically through our well-defined design color tokens in `src/app/globals.css`.
   - Batch minor tweaks into `edit_screens`.
3. **Update Registry**:
   - Record the active Light ID in `SCREENS.md`. If replacing an existing screen, move the old ID to `Superseded (to delete)`.
4. **Build in Code**:
   - Only the **Light mode** Stitch design is used as the visual reference model for our screens. Dark mode styling is derived automatically through design tokens in `src/app/globals.css`.
   - Rebuild in React using our tokens and `@/components/ui` primitives. Stitch HTML is reference only.
   - Inline notices use `Alert` from `@/components/ui`; never hand-roll a bordered notice box.

### 2.1 Signal vs. Noise in Stitch Models

Stitch generative models often generate unmapped static components not explicitly detailed in story briefs. Filter them during implementation:

- **Helpful Signal (Keep with `TODO`)**: If a visual element enhances UX or aligns with our operational roadmap (e.g. system status & latency indicators on login, "Menu Active" store status badge on catalog, drag-to-reorder affordances, contextual microcopy):
  - Retain the visual element in the JSX layout.
  - Annotate with an inline comment: `{/* TODO(<scope>): wire to ... (#<issue>) */}` documenting that it is currently static and indicating future dynamic wiring.
- **Unplanned Potential / Recommendations (Keep with comment)**: If an item in Stitch is not currently planned on our backlog but presents helpful architectural or operational potential (e.g. live terminal sync indicators, audit stamps):
  - Retain the visual structure or layout space where appropriate.
  - Add a recommendation comment: `{/* Recommendation: <reason why useful and potential future wiring> */}` to guide future contributors.
- **Irrelevant Noise (Drop)**: If a component is speculative, architecturally ungrounded, or misleading (e.g. claims of syncing to third-party POS hardware, redundant duplicate actions):
  - Drop or replace with an accurate, grounded alternative (e.g. replacing a POS sync footer with a clean category and product count tally).
- **Upcoming Actions (`<SoonBadge />`)**: For actions depicted in Stitch that are planned for a subsequent story (e.g. Google OAuth sign-in before backend provider configuration):
  - Use `<SoonItem />` from `@/components/feedback`: focusable and tappable, not `disabled` (tap shows a toast and emits `feature_interest`; see DESIGN_SYSTEM.md §8). Its accessible name ends with "(coming soon)".
  - A standalone element gets a discrete `<SoonBadge />` instead, with the same `aria-label`.
  - Add `{/* TODO(auth): ... */}` referencing the relevant issue.

## 3. Stitch MCP Discipline

- **Timeouts vs. Regeneration**: The "generate once" rule guards strictly against MCP transport timeouts. Because Stitch generates asynchronously on the server, **never retry immediately on timeout** — poll `list_screens` until the card appears. Intentional regeneration for major redesigns is fully permitted.
- **No device switching**: Do not attempt to fix or toggle device type on existing cards.