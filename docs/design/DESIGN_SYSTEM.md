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

There is no `danger` or `divider` token: warning icons and outlines use the solid `warning` (`text-warning`, `border-warning`), warning text stays on `warning-soft-foreground` for readability, errors use `destructive`, dividers use `border`. `npm run lint` fails on any class Tailwind does not generate (`scripts/check-tailwind-classes.mjs`), so a missing token must be added here and in `globals.css` rather than guessed.

| Token                     | Light     | Dark      | Use                                   |
| ------------------------- | --------- | --------- | ------------------------------------- |
| `background`              | `#f9f9ff` | `#0f1417` | App background                        |
| `foreground`              | `#171c22` | `#e5e9ee` | Body text                             |
| `card`                    | `#ffffff` | `#171d20` | Cards, sheets, list surfaces          |
| `card-foreground`         | `#171c22` | `#e5e9ee` | Text on cards                         |
| `muted`                   | `#e4e7ef` | `#232a2e` | Subtle fills, skeletons, "Soon" items |
| `muted-foreground`        | `#38404d` | `#a4adb8` | Secondary text, captions              |
| `border`                  | `#dde0e8` | `#2c3439` | Dividers, card outlines (decorative)  |
| `input`                   | `#737a86` | `#7c8692` | Form control outlines (≥ 3:1)         |
| `ring`                    | `#006c49` | `#5cd6a3` | Focus ring (2 px, 2 px offset)        |
| `primary`                 | `#006c49` | `#5cd6a3` | Primary actions, profit, positive     |
| `primary-foreground`      | `#ffffff` | `#00391f` | Text on primary                       |
| `primary-soft`            | `#d3efe1` | `#0f3d2c` | Selected nav item, READY status       |
| `primary-soft-foreground` | `#00402a` | `#b4f1d4` | Text on primary-soft                  |
| `secondary`               | `#855300` | `#ffb95c` | Sales highlight (legacy amber)        |
| `secondary-foreground`    | `#ffffff` | `#462a00` | Text on secondary                     |
| `warning`                 | `#d97706` | `#fbbf24` | Warning icons and outlines (non-text) |
| `warning-foreground`      | `#1c1100` | `#1c1100` | Text on solid warning                 |
| `warning-soft`            | `#fbe7cc` | `#4a3510` | PREPARING, unpaid, low stock          |
| `warning-soft-foreground` | `#5e3a00` | `#ffddb0` | Text on warning-soft                  |
| `info`                    | `#005ac2` | `#a9c7ff` | Links, NEW status, information        |
| `info-foreground`         | `#ffffff` | `#002f68` | Text on info                          |
| `destructive`             | `#ba1a1a` | `#ffb4ab` | Errors, cancel, delete                |
| `destructive-foreground`  | `#ffffff` | `#690005` | Text on destructive                   |
| `whatsapp`                | `#075e54` | `#075e54` | WhatsApp contact action (dark green)  |

### Contrast (WCAG 2.2 AA, computed)

| Pair                                   | Light | Dark  |
| -------------------------------------- | ----- | ----- |
| foreground / background                | 16.34 | 15.20 |
| muted-foreground / card                | 10.45 | 7.50  |
| muted-foreground / muted               | 8.45  | 6.41  |
| primary-foreground / primary           | 6.48  | 7.23  |
| primary / card (text, links)           | 6.48  | 9.41  |
| primary-soft-foreground / primary-soft | 9.74  | 9.55  |
| secondary-foreground / secondary       | 6.49  | 7.76  |
| info-foreground / info                 | 6.48  | 7.66  |
| destructive-foreground / destructive   | 6.46  | 7.72  |
| warning-soft-foreground / warning-soft | 8.36  | 8.97  |
| warning-foreground / warning           | 5.84  | 11.14 |
| warning / background (non-text, 3:1)   | 3.04  | 11.11 |
| warning / card (non-text, 3:1)         | 3.19  | 10.20 |
| white / whatsapp (button text)         | 7.67  | 7.67  |
| input / card (non-text, 3:1)           | 4.32  | 4.61  |

Re-run the check whenever a value changes; text pairs must stay ≥ 4.5:1, control outlines ≥ 3:1.

Keep subdued content readable by calibrating opacity against its rendered background in both themes,
rather than removing the visual hierarchy. Browser axe measurements for the current tokens:

| Subdued content                         | Utility                     | Light minimum | Dark minimum |
| --------------------------------------- | --------------------------- | ------------- | ------------ |
| Upcoming customer/manager timeline text | `text-muted-foreground/75`  | 4.99:1        | 4.80:1       |
| Product ingredients/allergen sections   | `opacity-85` on the section | 4.64:1        | 5.06:1       |

These values include a margin above AA; remeasure after token, background, or nested opacity changes.

### Order and payment status mapping

| Status    | Surface                                       | Label                          |
| --------- | --------------------------------------------- | ------------------------------ |
| NEW       | `info`                                        | "New" / "Nouvelle"             |
| CONFIRMED | `card` + `info` outline                       | "Confirmed" / "Confirmée"      |
| PREPARING | `warning-soft`                                | "Preparing" / "En préparation" |
| READY     | `primary-soft`                                | "Ready" / "Prête"              |
| COMPLETED | `muted`                                       | "Completed" / "Terminée"       |
| CANCELLED | `card` + `destructive` outline, struck amount | "Cancelled" / "Annulée"        |
| Unpaid    | `warning-soft`                                | "Unpaid" / "Non payée"         |
| Paid      | `primary-soft`                                | "Paid" / "Payée"               |

## 3. Typography

Inter only (`next/font`, Latin + Latin Extended), `font-feature-settings: "tnum"` via `tabular-nums` on every amount, quantity, time and KPI. Body never below 16 px on inputs (prevents iOS zoom).

| Utility             | Size / line  | Weight | Use                          |
| ------------------- | ------------ | ------ | ---------------------------- |
| `text-display`      | 32 / 40      | 600    | KPI hero value               |
| `text-title-lg`     | 22 / 28      | 600    | Screen title, settings h1    |
| `text-title-md`     | 18 / 24      | 600    | Sheet, dialog, app-bar title |
| `text-title-sm`     | 16 / 24      | 600    | Section titles               |
| `text-body-md`      | 16 / 24      | 400    | Body, inputs                 |
| `text-body-sm`      | 14 / 20      | 400    | Secondary text, list meta    |
| `text-label-md`     | 14 / 20      | 500    | Buttons, tabs, form labels   |
| `text-label-strong` | 13 / 18      | 600    | Compact emphasised labels    |
| `text-label-sm`     | 12 / 16      | 500    | Badges, captions, nav labels |
| `text-caption`      | 11 / inherit | n/a    | Dense badges and meta        |
| `text-micro`        | 10 / inherit | n/a    | Count pills and tiny tags    |

The first nine are `@utility` blocks (size, line height and weight together, so variants such as `md:text-title-lg` work); `text-caption` and `text-micro` are `--text-*` theme sizes. A composite utility sits in the utilities layer, so a later `font-*` or `leading-*` on the same element overrides its weight or line height. `src/lib/utils.ts` teaches `cn()` (tailwind-merge) all of these names.

### Title roles

Titles look the same on every screen: each role has one utility that carries size, line height and weight, and a title takes no `text-<size>`, `font-*` or `leading-*` override. `text-foreground`, spacing, truncation and layout classes are fine.

| Role                                 | Element                        | Utility                                                        |
| ------------------------------------ | ------------------------------ | -------------------------------------------------------------- |
| Screen title (one per screen)        | `h1`                           | `text-title-lg`                                                |
| Compact app-bar title                | `h1` in a sticky top bar       | `text-title-md`                                                |
| Section title                        | `h2`                           | `text-title-sm`                                                |
| Group label (overline above a group) | `h2`/`h3`                      | `text-label-sm uppercase tracking-wider text-muted-foreground` |
| Sheet and dialog title               | `SheetTitle`, `DialogTitle`    | component default (`text-title-md`)                            |
| Card and list-item title             | `h3` or the row's primary text | `text-label-md`                                                |

Exceptions only where common practice calls for them, each noted next to the code: storefront marketing headings (hero, product name on its detail page) may use `text-display`, and visually hidden headings (`sr-only`). Every screen uses these roles.

Other tokens in `globals.css`:

- `--breakpoint-xs` 25 rem (400 px): `xs:` variant for narrow phones. It stays at 25 rem because below 400 px the brand name would crowd the header actions.
- Motion: `animate-pop-in` (180 ms), `animate-fade-in` / `animate-fade-out` (150 ms); `motion-reduce:animate-none` disables them.
- Safe areas: `pb-safe`, `pb-safe-N` (spacing N plus inset), `pb-safe-min-N` / `pt-safe-min-N` (larger of the two), `bottom-sticky-safe` (sticky bars), `w-screen-gutter` (width minus the 16 px gutters).
- `bg-dot-grid` (map placeholder dots), `no-scrollbar`, `tabular-nums`.

Letter spacing 0 except `display` (−0.01em). Max two weights per screen besides 400.

## 4. Spacing, radius, elevation, motion

- **Spacing:** 4 px base, Tailwind default scale. Screen gutter 16 px (`px-4`); section gap 24 px (`gap-6`); list row padding 12–16 px.
- **Radius:** `sm` 4 px (badges), `md` 8 px (buttons, inputs, cards), `lg` 12 px (sheets, dialogs), `full` (pills, avatars, FAB). Matches Stitch `ROUND_EIGHT`.
- **Elevation:** flat. Cards use `border`; only overlays (sheet, dialog, toast, sticky bars) get a single soft shadow token. Dark mode uses lighter surfaces instead of shadows.
- **Motion:** `duration-150` for press/hover feedback, `duration-200` for sheets/dialogs/toasts; `ease-out`; opacity and transform only; all disabled under `motion-reduce`.

## 5. Layout, grid and safe areas

- Mobile first, 360–430 px design width (Stitch frames: mobile). Single column, 16 px gutters.
- `sm` ≥ 640: wider gutters; `lg` ≥ 1024: manager sidebar replaces bottom nav, content max-width 72 rem; storefront grid 2–4 columns, content max-width 64 rem.
- The root `viewport` export sets `viewportFit: "cover"`; without it every `env(safe-area-inset-*)` resolves to 0. `ActionBar` (`bottom-above-nav`) keeps sticky bars above the manager bottom nav.
- Fixed top bars add `env(safe-area-inset-top)`; bottom nav, sticky action bars and toasts add `env(safe-area-inset-bottom)`.
- Viewport `interactive-widget=resizes-content`; forms scroll, submit buttons are never covered by the keyboard.
- Touch targets ≥ 36 × 36 px (`min-h-9 min-w-9`), ≥ 8 px apart.
- Owner-approved 32 px exceptions (still above WCAG 2.2 AA 2.5.8's 24 px): the add button on catalog rows, so it covers less of the photo (#228), and the storefront Delivery/Pickup segments, so the toggle matches the 38 px readiness badge (#227). A new exception needs owner approval and is listed here.
- Use larger targets where the design already gives them room (primary actions, featured cards). Never enlarge a control that already meets 36 px at the cost of a polished layout.

## 6. Iconography

lucide-react, 24 px in navigation and list leading positions, 20 px inline with text, 1.5–2 px stroke, `currentColor`. Icon-only buttons need an `aria-label`. No emoji, no filled icon sets, no brand illustrations.

## 7. Component inventory

Every component exposes `data-testid` and supports light/dark. States to design and implement: **default, pressed (`active:`), focus-visible, disabled, loading, error**, plus **empty** for collections.

| Component                                               | Source       | Notes                                                                             |
| ------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| Button (primary, secondary/outline, ghost, destructive) | shadcn       | 48 px height; loading shows spinner + keeps label width                           |
| Icon button                                             | shadcn       | 48 × 48 hit area, 24 px icon                                                      |
| Input, Textarea, Select, NativeSelect, Checkbox, Switch | shadcn       | Wrapped in `Field`: label above, hint/error wired, error = icon + text            |
| Field                                                   | custom       | Label + control + hint + error; wires `id`, `aria-describedby`, `aria-invalid`    |
| Segmented control                                       | custom       | Radio group as segments; roving tabindex, arrow keys                              |
| Money input                                             | custom       | EUR, `inputmode="decimal"`, tabular, locale separator                             |
| Card                                                    | shadcn       | Border, `md` radius, 16 px padding                                                |
| KPI card                                                | custom       | `label-sm` label, `display` value, delta with icon + sign                         |
| List row                                                | custom       | Leading icon/thumb, title, meta, trailing value/chevron; ≥ 56 px                  |
| Badge / status pill                                     | shadcn       | Uses status mapping, always text                                                  |
| Tabs / segmented filter                                 | shadcn       | Horizontal scroll on mobile, count in label                                       |
| Sheet (bottom)                                          | shadcn       | Drag handle, title, sticky footer actions                                         |
| Dialog                                                  | shadcn       | Custom content; use `ConfirmDialog` for plain confirmations                       |
| Confirm dialog                                          | custom       | Destructive variant: alertdialog, focus starts on Cancel                          |
| Toast                                                   | shadcn       | Bottom, above nav; auto-dismiss 4 s; action optional; error variant (`showError`) |
| Skeleton                                                | shadcn       | Matches final layout; no shimmer under reduced motion                             |
| Empty state                                             | custom (#34) | Icon, one-line title, one-line hint, one action                                   |
| Error state                                             | custom (#34) | Icon, message, retry action                                                       |
| Bottom nav                                              | custom (#29) | 5 items, center Add; active = soft fill + bold label + icon fill                  |
| Action bar (`ActionBar`)                                | custom       | The one sticky bar: manager form save (above nav), storefront cart/checkout       |
| Quantity stepper                                        | custom       | − / value / +, 48 px buttons                                                      |
| Soon badge + soon item                                  | custom (#33) | See §8                                                                            |

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
- [ ] Targets ≥ 36 px (32 px only for the §5 exceptions); visible focus on every interactive element
- [ ] Semantic landmarks (`header`, `nav`, `main`), one `h1` per screen
- [ ] Labels on every control; errors linked via `aria-describedby`
- [ ] Status never conveyed by colour alone
- [ ] Sheets and dialogs trap and restore focus; Escape closes
- [ ] `prefers-reduced-motion` respected
- [ ] `<html lang>` matches the locale; FR copy fits without truncation

## 11. Stitch mirror

| Item                  | Value                                         |
| --------------------- | --------------------------------------------- |
| Project               | FoodBiz PWA — `10916445985537244105`          |
| Design system (light) | FoodBiz Light — `assets/14358508387441273017` |

Active screen IDs live in [`SCREENS.md`](SCREENS.md#active-stitch-screens). **Generation of dark theme models in Stitch is strictly banned**; our design tokens in `src/app/globals.css` provide the Dark theme mapping automatically.

**Stitch palette vs our tokens.** Stitch turns the seed and override colours into its own Material palette, and its palette card shows that result, not our table. In FoodBiz Light, background `#f9f9ff`, secondary `#855300`, error `#ba1a1a` and white cards match. But Stitch's `primary` is `#005136` (ours, `#006c49`, becomes `primary_container`) and its `tertiary` is `#004394` (ours, `#005ac2`, becomes `tertiary_container`). Our soft and status tokens (`primary-soft`, `warning-soft`, …) have no equivalent in Stitch. Treat §2 as the spec and the palette card as approximate; prompts give the exact hex values. The HTML export is a visual reference only.

### Working with Stitch (agents)

Every `generate_screen_from_text`, `edit_screens` and `generate_variants` call creates a **new screen card**, and the old card stays. So:

1. **Generate once per screen (Light mode only).** Pass `designSystem` explicitly (`assets/14358508387441273017`), `deviceType: MOBILE`, and the exact hex values from §2 in the prompt. **Generating dark theme models is strictly banned.**
2. **Never retry on timeout or connection loss.** Generation continues on the server; poll `list_screens` / `get_screen` until the screen appears.
3. **Inspect before changing** with `get_screen` (screenshot + HTML). Edit only when the owner asks or a real defect exists, and batch all fixes into one `edit_screens` call.
4. **Don't fix the device type.** Screens may be stored as `DESKTOP`; the HTML is responsive and Stitch Preview → Mobile shows the real layout.
5. **Update the registry** in `SCREENS.md` after every call that creates a screen: new ID becomes active, the previous one moves to "superseded". Stitch MCP cannot delete screens; the owner cleans them up manually.
