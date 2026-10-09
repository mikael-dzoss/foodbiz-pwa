# FoodBiz Component Registry

Complete reference of reusable UI primitives, feedback states, and design system components.
**Code is the source of truth:** every component enforces design tokens from [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), accessibility (WCAG 2.2 AA), touch targets (≥ 44px), and `data-testid` passthrough.

Visual reference: Stitch screen **P-01 Patterns reference** ([Light: `4b89d3e37632415da28bd4ed0fab6456`](https://stitch.withgoogle.com), [Dark: `0d3d1062fa27420e908bebabfc162f05`](https://stitch.withgoogle.com)).
Interactive local inventory: `/patterns` (dev route).

---

## 1. Summary Index

| Category         | Component         | File Path                                 | Source / Primitive         | Touch Target             |
| :--------------- | :---------------- | :---------------------------------------- | :------------------------- | :----------------------- |
| **Actions**      | `Button`          | `src/components/ui/button.tsx`            | custom / Slot              | 48px (`h-12`)            |
| **Forms**        | `Input`           | `src/components/ui/input.tsx`             | custom HTML                | 48px (`h-12`), 16px text |
| **Forms**        | `Textarea`        | `src/components/ui/textarea.tsx`          | custom HTML                | min 96px (`min-h-24`)    |
| **Forms**        | `Select`          | `src/components/ui/select.tsx`            | `@radix-ui/react-select`   | 48px trigger, 44px items |
| **Forms**        | `Checkbox`        | `src/components/ui/checkbox.tsx`          | `@radix-ui/react-checkbox` | 44px tap area            |
| **Forms**        | `Switch`          | `src/components/ui/switch.tsx`            | `@radix-ui/react-switch`   | 44px tap area            |
| **Data Display** | `Card`            | `src/components/ui/card.tsx`              | custom HTML                | —                        |
| **Data Display** | `KPICard`         | `src/components/ui/kpi-card.tsx`          | custom Card                | —                        |
| **Data Display** | `ListRow`         | `src/components/ui/list-row.tsx`          | custom interactive         | ≥ 56px (`min-h-14`)      |
| **Data Display** | `Badge`           | `src/components/ui/badge.tsx`             | custom HTML                | —                        |
| **Navigation**   | `Tabs`            | `src/components/ui/tabs.tsx`              | `@radix-ui/react-tabs`     | 44px triggers            |
| **Overlays**     | `Dialog`          | `src/components/ui/dialog.tsx`            | `@radix-ui/react-dialog`   | 44px close icon          |
| **Overlays**     | `Sheet`           | `src/components/ui/sheet.tsx`             | `@radix-ui/react-dialog`   | 44px close icon          |
| **Feedback**     | `Toast`           | `src/components/ui/toast.tsx`             | custom Context             | —                        |
| **Feedback**     | `Skeleton`        | `src/components/ui/skeleton.tsx`          | custom HTML                | —                        |
| **Feedback**     | `EmptyState`      | `src/components/feedback/empty-state.tsx` | custom Card                | 48px action              |
| **Feedback**     | `ErrorState`      | `src/components/feedback/error-state.tsx` | custom Card                | 48px retry               |
| **Coming Soon**  | `SoonBadge`       | `src/components/feedback/soon-badge.tsx`  | custom HTML                | —                        |
| **Coming Soon**  | `SoonItem`        | `src/components/feedback/soon-item.tsx`   | custom Row                 | ≥ 56px (`min-h-14`)      |
| **Controls**     | `QuantityStepper` | `src/components/ui/quantity-stepper.tsx`  | custom Button              | 48px (`h-12 w-12`)       |

---

## 2. Actions & Form Components

### Button

- **Import:** `import { Button } from "@/components/ui"`
- **Variants:** `default` (forest green `#006c49`), `secondary` (`primary-soft`), `outline`, `ghost`, `destructive`, `link`.
- **Sizes:** `default` (`h-12 px-4 text-sm`), `sm` (`h-11 px-3 text-xs`), `lg` (`h-14 px-8 text-base`), `icon` (`h-12 w-12`).
- **Features:**
  - `loading` prop shows animated spinner while keeping text width.
  - `asChild` support via Radix Slot for Next.js `<Link>`.
  - Press feedback: `active:scale-[0.99]`, disabled under `prefers-reduced-motion`.

### Input & Textarea

- **Import:** `import { Input, Textarea } from "@/components/ui"`
- **Ergonomics:**
  - Font size is 16px (`text-base`) on mobile to prevent iOS Safari auto-zooming on focus.
  - Form control borders use `border-input` (contrast ≥ 3:1 in both light and dark modes).
  - Error state (`error={true}`) applies `border-destructive` and focus ring in destructive color.

### Select

- **Import:** `import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui"`
- **Accessibility:** Full keyboard navigation (Arrow Up/Down, Enter/Space, Escape), ARIA listbox attributes. Items feature 44px touch height.

### Switch & Checkbox

- **Import:** `import { Switch, Checkbox } from "@/components/ui"`
- **Ergonomics:** Both components wrap the control in a `min-h-11 min-w-11` container to ensure 44px minimum tap target according to WCAG 2.5.5 / 2.5.8.

---

## 3. Data Display & Structure

### Card

- **Import:** `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui"`
- **Design Rules:** Flat surfaces with subtle 1px border (`border-border`), no heavy shadows, `rounded-md` radius.

### KPICard

- **Import:** `import { KPICard } from "@/components/ui"`
- **Props:**
  - `label`: Metric title (uppercase, `text-label-sm`).
  - `value`: Main figure (uses `text-display tabular-nums font-semibold`).
  - `delta`: Optional trend badge (`percentage`, `isPositive`, `periodLabel`).

### ListRow

- **Import:** `import { ListRow } from "@/components/ui"`
- **Props:** `title`, `subtitle`, `leading` (icon/avatar), `trailing` (value/status), `showChevron`, `onClick`.
- **Height:** Minimum 56px (`min-h-14`) for mobile list scanning.

### Badge

- **Import:** `import { Badge } from "@/components/ui"`
- **Domain Status Variants:**
  - `new`: `#005ac2` (info)
  - `confirmed`: card background + info outline
  - `preparing`: `#fbe7cc` / `#4a3510` (warning-soft)
  - `ready`: `#d3efe1` / `#0f3d2c` (primary-soft)
  - `completed`: `#eef0f6` / `#232a2e` (muted)
  - `cancelled`: card background + destructive outline
  - `paid`: primary-soft
  - `unpaid`: warning-soft

---

## 4. Feedback & "Coming Soon" Pattern

### SoonItem & SoonBadge

- **Import:** `import { SoonItem, SoonBadge } from "@/components/feedback"`
- **Behavior:**
  - Unimplemented features are never hidden or disabled.
  - Displayed with `muted` background, `muted-foreground` text, and a `Soon` badge.
  - Interactive and focusable (`tabIndex={0}`, `role="button"`).
  - Tapping displays a Toast notification (_"Coming soon — we noted your interest"_) and dispatches a telemetry event via `emitFeatureInterest(featureKey)`.
  - Accessible name automatically appends `"(coming soon)"` for screen readers.

### EmptyState & ErrorState

- **Import:** `import { EmptyState, ErrorState } from "@/components/feedback"`
- **Usage:**
  - `EmptyState`: Renders when collections or queries have 0 items. Displays icon, one-line title, one-line hint, and optional action button.
  - `ErrorState`: Accessible error banner (`role="alert"`) with warning icon, error explanation, and retry callback.

---

## 5. Overlay Primitives

### Sheet (Bottom Drawer)

- **Import:** `import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui"`
- **Mobile ergonomics:** Centered drag handle pill at top, sticky footer actions, auto-padding for `env(safe-area-inset-bottom)`.

### Toast

- **Import:** `import { ToastProvider, useToast } from "@/components/ui"`
- **Hook:** `const { showToast } = useToast();`
- **Presentation:** Dark neutral floating notification pill positioned above bottom navigation (`bottom-20`), auto-dismisses after 4 seconds.

---

## 6. Testing & Quality Standards

- **`data-testid` convention:** All interactive elements expose `data-testid` props passthrough.
- **Motion:** Transitions limited to 150–200ms opacity/transform only; all transitions disabled under `prefers-reduced-motion: reduce`.
- **Contrast:** Every text-surface pair verified at ≥ 4.5:1; input controls at ≥ 3:1 in both light and dark modes.
