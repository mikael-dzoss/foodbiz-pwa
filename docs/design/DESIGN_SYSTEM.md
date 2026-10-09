# FoodBiz Design System

Single reference for the manager app and the storefront. **Code is the source of truth:** the tokens below are implemented in `src/app/globals.css` (story #26) and mirrored one-way into Stitch. Changing a token means a PR here first, then `update_design_system` + `apply_design_system` in Stitch.

Screen inventory and loop status: [`SCREENS.md`](SCREENS.md).

## 1. Principles

1. **Calm and functional.** Flat surfaces, 1 px borders, no gradients, no decorative imagery or illustration, at most one accent colour per area.
2. **One thumb.** Primary actions sit in the bottom half of the screen; bottom navigation and sticky action bars on mobile.
3. **Numbers first.** Prices, totals and KPIs use tabular figures and the strongest type weight on the screen.
4. **Light and dark are equal.** Every token has both values; every screen is designed, implemented and verified in both. Theme follows the system by default; user can force light or dark.
5. **Never colour-only.** Status, selection and errors always carry text or an icon too.
6. **Bilingual by design.** Layouts tolerate French strings ~20–30 % longer than English; no fixed-width text containers.
7. **Quiet motion.** 150–200 ms opacity/transform only; none under `prefers-reduced-motion`.

## 2. Colour tokens

Names follow shadcn/ui conventions so #28 can consume them directly. Hex values are the spec; components only use the Tailwind utilities (`bg-primary`, `text-muted-foreground`, …).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#f9f9ff` | `#0f1417` | App background |
| `foreground` | `#171c22` | `#e5e9ee` | Body text |
| `card` | `#ffffff` | `#171d20` | Cards, sheets, list surfaces |
| `card-foreground` | `#171c22` | `#e5e9ee` | Text on cards |
| `muted` | `#eef0f6` | `#232a2e` | Subtle fills, skeletons, "Soon" items |
| `muted-foreground` | `#4f5662` | `#a4adb8` | Secondary text, captions |
| `border` | `#dde0e8` | `#2c3439` | Dividers, card outlines (decorative) |
| `input` | `#737a86` | `#7c8692` | Form control outlines (≥ 3:1) |
| `ring` | `#006c49` | `#5cd6a3` | Focus ring (2 px, 2 px offset) |
| `primary` | `#006c49` | `#5cd6a3` | Primary actions, profit, positive |
| `primary-foreground` | `#ffffff` | `#00391f` | Text on primary |
| `primary-soft` | `#d3efe1` | `#0f3d2c` | Selected nav item, READY status |
| `primary-soft-foreground` | `#00402a` | `#b4f1d4` | Text on primary-soft |
| `secondary` | `#855300` | `#ffb95c` | Sales highlight (legacy amber) |
| `secondary-foreground` | `#ffffff` | `#462a00` | Text on secondary |
| `warning-soft` | `#fbe7cc` | `#4a3510` | PREPARING, unpaid, low stock |
| `warning-soft-foreground` | `#5e3a00` | `#ffddb0` | Text on warning-soft |
| `info` | `#005ac2` | `#a9c7ff` | Links, NEW status, information |
| `info-foreground` | `#ffffff` | `#002f68` | Text on info |
| `destructive` | `#ba1a1a` | `#ffb4ab` | Errors, cancel, delete |
| `destructive-foreground` | `#ffffff` | `#690005` | Text on destructive |

### Contrast (WCAG 2.2 AA, computed)

| Pair | Light | Dark |
| --- | --- | --- |
| foreground / background | 16.34 | 15.20 |
| muted-foreground / card | 7.39 | 7.50 |
| muted-foreground / muted | 6.49 | 6.41 |
| primary-foreground / primary | 6.48 | 7.23 |
| primary / card (text, links) | 6.48 | 9.41 |
| primary-soft-foreground / primary-soft | 9.74 | 9.55 |
| secondary-foreground / secondary | 6.49 | 7.76 |
| info-foreground / info | 6.48 | 7.66 |
| destructive-foreground / destructive | 6.46 | 7.72 |
| warning-soft-foreground / warning-soft | 8.36 | 8.97 |
| input / card (non-text, 3:1) | 4.32 | 4.61 |

Re-run the check whenever a value changes; text pairs must stay ≥ 4.5:1, control outlines ≥ 3:1.

### Order and payment status mapping

| Status | Surface | Label |
| --- | --- | --- |
| NEW | `info` | "New" / "Nouvelle" |
| CONFIRMED | `card` + `info` outline | "Confirmed" / "Confirmée" |
| PREPARING | `warning-soft` | "Preparing" / "En préparation" |
| READY | `primary-soft` | "Ready" / "Prête" |
| COMPLETED | `muted` | "Completed" / "Terminée" |
| CANCELLED | `card` + `destructive` outline, struck amount | "Cancelled" / "Annulée" |
| Unpaid | `warning-soft` | "Unpaid" / "Non payée" |
| Paid | `primary-soft` | "Paid" / "Payée" |

## 3. Typography

Inter only (`next/font`, Latin + Latin Extended), `font-feature-settings: "tnum"` via `tabular-nums` on every amount, quantity, time and KPI. Body never below 16 px on inputs (prevents iOS zoom).

| Token | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `display` | 32 / 40 | 600 | KPI hero value |
| `title-lg` | 22 / 28 | 600 | Screen title |
| `title-md` | 18 / 24 | 600 | Section and card titles |
| `body-md` | 16 / 24 | 400 | Body, inputs |
| `body-sm` | 14 / 20 | 400 | Secondary text, list meta |
| `label-md` | 14 / 20 | 500 | Buttons, tabs, form labels |
| `label-sm` | 12 / 16 | 500 | Badges, captions, nav labels |

Letter spacing 0 except `display` (−0.01em). Max two weights per screen besides 400.

## 4. Spacing, radius, elevation, motion

- **Spacing:** 4 px base, Tailwind default scale. Screen gutter 16 px (`px-4`); section gap 24 px (`gap-6`); list row padding 12–16 px.
- **Radius:** `sm` 4 px (badges), `md` 8 px (buttons, inputs, cards), `lg` 12 px (sheets, dialogs), `full` (pills, avatars, FAB). Matches Stitch `ROUND_EIGHT`.
- **Elevation:** flat. Cards use `border`; only overlays (sheet, dialog, toast, sticky bars) get a single soft shadow token. Dark mode uses lighter surfaces instead of shadows.
- **Motion:** `duration-150` for press/hover feedback, `duration-200` for sheets/dialogs/toasts; `ease-out`; opacity and transform only; all disabled under `motion-reduce`.

## 5. Layout, grid and safe areas

- Mobile first, 360–430 px design width (Stitch frames: mobile). Single column, 16 px gutters.
- `sm` ≥ 640: wider gutters; `lg` ≥ 1024: manager sidebar replaces bottom nav, content max-width 72 rem; storefront grid 2–4 columns, content max-width 64 rem.
- Fixed top bars add `env(safe-area-inset-top)`; bottom nav, sticky action bars and toasts add `env(safe-area-inset-bottom)`.
- Viewport `interactive-widget=resizes-content`; forms scroll, submit buttons are never covered by the keyboard.
- Touch targets ≥ 48 × 48 px (`min-h-12 min-w-12`), ≥ 8 px apart.

## 6. Iconography

lucide-react, 24 px in navigation and list leading positions, 20 px inline with text, 1.5–2 px stroke, `currentColor`. Icon-only buttons need an `aria-label`. No emoji, no filled icon sets, no brand illustrations.

## 7. Component inventory

Every component exposes `data-testid` and supports light/dark. States to design and implement: **default, pressed (`active:`), focus-visible, disabled, loading, error**, plus **empty** for collections.

| Component | Source | Notes |
| --- | --- | --- |
| Button (primary, secondary/outline, ghost, destructive) | shadcn | 48 px height; loading shows spinner + keeps label width |
| Icon button | shadcn | 48 × 48 hit area, 24 px icon |
| Input, Textarea, Select, Checkbox, Switch | shadcn | Label above, helper/error below, error = icon + text |
| Money input | custom | EUR, `inputmode="decimal"`, tabular, locale separator |
| Card | shadcn | Border, `md` radius, 16 px padding |
| KPI card | custom | `label-sm` label, `display` value, delta with icon + sign |
| List row | custom | Leading icon/thumb, title, meta, trailing value/chevron; ≥ 56 px |
| Badge / status pill | shadcn | Uses status mapping, always text |
| Tabs / segmented filter | shadcn | Horizontal scroll on mobile, count in label |
| Sheet (bottom) | shadcn | Drag handle, title, sticky footer actions |
| Dialog | shadcn | Confirmations only (cancel order, delete) |
| Toast | shadcn | Bottom, above nav; auto-dismiss 4 s; action optional |
| Skeleton | shadcn | Matches final layout; no shimmer under reduced motion |
| Empty state | custom (#34) | Icon, one-line title, one-line hint, one action |
| Error state | custom (#34) | Icon, message, retry action |
| Bottom nav | custom (#29) | 5 items, center Add; active = soft fill + bold label + icon fill |
| Sticky action bar | custom | Storefront cart/checkout, manager form save |
| Quantity stepper | custom | − / value / +, 48 px buttons |
| Soon badge + soon item | custom (#33) | See §8 |

## 8. "Coming soon" pattern

- Item stays in place, rendered with `muted` surface and `muted-foreground` text plus a `Soon` / `Bientôt` badge (`label-sm`, `muted` outline).
- **Not disabled:** focusable, tappable; tap shows a toast "Coming soon — we noted your interest" and emits `feature_interest` with the feature key.
- Accessible name includes "coming soon"; never relies on opacity alone.

## 9. Content and tone (EN / FR)

- Plain words: "Revenue", "Costs", "Net profit" / « Chiffre d'affaires », « Dépenses », « Bénéfice net ».
- Sentence case, verbs on buttons ("Save product" / « Enregistrer le produit »), no exclamation marks, no jargon.
- Amounts: EN `€12.50`, FR `12,50 €` (#32). Dates and times per locale.
- Errors say what happened and what to do next.
- French text is the length test: every frame is checked with FR copy.

## 10. Accessibility checklist

- [ ] Text contrast ≥ 4.5:1, controls and focus ring ≥ 3:1, in light and dark
- [ ] Targets ≥ 48 px; visible focus on every interactive element
- [ ] Semantic landmarks (`header`, `nav`, `main`), one `h1` per screen
- [ ] Labels on every control; errors linked via `aria-describedby`
- [ ] Status never conveyed by colour alone
- [ ] Sheets and dialogs trap and restore focus; Escape closes
- [ ] `prefers-reduced-motion` respected
- [ ] `<html lang>` matches the locale; FR copy fits without truncation

## 11. Stitch mirror

| Item | Value |
| --- | --- |
| Project | FoodBiz PWA — `10916445985537244105` |
| Design system (light) | FoodBiz Light — `assets/14358508387441273017` |
| Design system (dark) | FoodBiz Dark — `assets/14014574616527079101` |

Active screen IDs live in [`SCREENS.md`](SCREENS.md#active-stitch-screens).

**Stitch palette vs our tokens.** Stitch turns the seed and override colours into its own Material palette, and its palette card shows that result, not our table. In FoodBiz Light, background `#f9f9ff`, secondary `#855300`, error `#ba1a1a` and white cards match. But Stitch's `primary` is `#005136` (ours, `#006c49`, becomes `primary_container`) and its `tertiary` is `#004394` (ours, `#005ac2`, becomes `tertiary_container`). Our soft and status tokens (`primary-soft`, `warning-soft`, …) have no equivalent in Stitch. Treat §2 as the spec and the palette card as approximate; prompts give the exact hex values. Other limits: one colour mode per design system (hence light + dark), radius 4/8/12/full, `spacing`/`typography` maps accepted but not shown in Stitch. The HTML export is a visual reference only.

### Working with Stitch (agents)

Every `generate_screen_from_text`, `edit_screens` and `generate_variants` call creates a **new screen card**, and the old card stays. So:

1. **Generate once per screen and mode.** Pass `designSystem` explicitly (light or dark ID above), `deviceType: MOBILE`, and the exact hex values from §2 in the prompt.
2. **Never retry on timeout or connection loss.** Generation continues on the server; poll `list_screens` / `get_screen` until the screen appears.
3. **Inspect before changing** with `get_screen` (screenshot + HTML). Edit only when the owner asks or a real defect exists, and batch all fixes into one `edit_screens` call.
4. **Don't fix the device type.** Screens may be stored as `DESKTOP`; the HTML is responsive and Stitch Preview → Mobile shows the real layout.
5. **Update the registry** in `SCREENS.md` after every call that creates a screen: new ID becomes active, the previous one moves to "superseded". Stitch MCP cannot delete screens; the owner cleans them up manually.
