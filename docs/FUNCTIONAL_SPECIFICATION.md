# FoodBiz PWA — Functional Specification

Carried over from the legacy FoodBiz Manager mobile app and extended with the customer storefront. Legacy status columns below are for reference only.

**Implementation status** (checked against `src/app` and `src/features`; business rules below are unchanged):

| Module                             | Status       | Notes                                                                                                             |
| ---------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Auth (Google sign-in, route guard) | Built        | Membership in `business_members` is required                                                                      |
| Dashboard                          | Built        | KPI cards with period picker, recent activity, operational widgets                                                |
| Products and categories            | Built        | CRUD, stock adjustment, images, soft delete                                                                       |
| Orders                             | Built        | List, manual order, detail, status changes, realtime new-order alerts                                             |
| Expenses                           | Built        | List and create                                                                                                   |
| Customers                          | Built        | List, detail, metrics (not in the module table below)                                                             |
| Settings                           | Built        | Hub with business, ordering, payment, inventory and finance, notifications, account, about pages                  |
| Account                            | Partly built | Shows profile, language setting and sign-out; no profile editing found                                            |
| Analytics                          | Not started  | No route; only a "soon" placeholder entry in the feature registry                                                 |
| Storefront                         | Built        | Catalog, product, cart, checkout (guest, no accounts), confirmation, tracking, order lookup, shop info; EN and FR |
| Offline support                    | Not started  | No service worker                                                                                                 |

## 1. Product vision

A web app for small, part-time food business owners (home bakers, meal prep, food trucks) to replace scattered spreadsheets and notebooks, plus an online storefront where their customers browse products and order.

**Design philosophy:** radical accessibility through minimal friction.

- **Mobile-first:** single-hand workflows, 44px+ touch targets, clean layouts.
- **One screen away:** the dashboard surfaces key metrics.
- **Zero jargon:** "Revenue", "Costs", "Net Profit" — plain terms only.

**Target manager:** solo operator, 10–50 products, 5–30 orders/day, needs quick data entry between cooking and serving.

## 2. Roles

| Role         | Surface                                         | Capabilities                                                         |
| ------------ | ----------------------------------------------- | -------------------------------------------------------------------- |
| **Manager**  | Dashboard (installable PWA)                     | Manage products, orders, expenses; view dashboard and analytics      |
| **Customer** | Storefront (SSR, SEO-friendly, installable PWA) | Browse visible products, place orders without app-store installation |

Data segregation between roles is enforced with Supabase Row Level Security (see [`architecture.md`](architecture.md)). The exact customer sign-in/checkout flow is not yet defined.

**Member roles.** A business member is an `owner`, a `manager` or `staff` (`business_members.role`; the first member of a business is its owner). Every member can run day-to-day operations (products, orders, customers, expenses, ordering and notification settings, business profile). **Owner-only** means that only a member whose role is `owner` can:

1. change payment identifiers and payment-method settings (Revolut tag, Wero identifier, enabled payment methods, payment instructions);
2. change the business slug (the public storefront address);
3. hard-delete rows (orders, expenses, guests, products); catalog categories can still be deleted by any member when empty;

and that nobody, owner included, can delete a business's settings row through the application. The rule is enforced by the database (RLS policies and a trigger raising `OWNER_REQUIRED`) and again by the Server Actions, which answer with the typed `FORBIDDEN` code; the settings and expense screens show the controls disabled with an explanation. Details: [`database/schema.md`](database/schema.md#52-access-control-matrix).

## 3. Manager modules

| Module        | Key functionality                                                            | Legacy status           |
| ------------- | ---------------------------------------------------------------------------- | ----------------------- |
| **Auth**      | Manager sign-in; guard for manager routes                                    | Complete (Google OAuth) |
| **Dashboard** | KPI cards (revenue, costs, profit), recent activity                          | 60%                     |
| **Products**  | CRUD, search, filters, categories, stock indicators, auto-decrement of stock | 80%                     |
| **Orders**    | List, status filters, order creation, status progression                     | 70%                     |
| **Expenses**  | CRUD, category tags, feeds dashboard KPIs                                    | Complete                |
| **Analytics** | Charts, date-range filters over revenue, costs and profit                    | 20% (skeleton)          |
| **Settings**  | Currency, low-stock threshold, tax, notifications, theme                     | Complete                |
| **Account**   | Profile display and editing                                                  | 50%                     |

Not carried over: native-only features (bottom-tab FAB, drawer, gesture scrubbing). Navigation structure for the PWA is not yet designed.

## 4. Customer storefront (new)

- Public catalog of **visible** products with price, image and category, rendered server-side for SEO.
- Product availability reflects stock.
- Customers can place an order from a URL; the order is linked to a `Customer` record and appears in the manager's orders list.
- Installation is optional; the storefront must work in a plain browser.

Open questions (undecided): customer accounts vs guest checkout, payment handling, order notifications.

## 5. Core business rules

1. **Negative inventory prevention:** checkout decrements stock; stock cannot go below zero. Orders exceeding stock must be blocked or flagged, not silently truncated.
2. **Soft deletion:** products are hidden (`visible = false`), never hard-deleted through the app, to protect historical order references. Categories can be permanently deleted by any business member only when empty (`products.category_id` is `ON DELETE RESTRICT`, so assigned products must be reassigned first). Expenses can be permanently deleted by the business `owner` only.
3. **Order lifecycle:** statuses are `NEW`, `CONFIRMED`, `PREPARING`, `READY`, `COMPLETED`, and `CANCELLED` (there is no `DELIVERED` status). Allowed transitions (`ALLOWED_ORDER_TRANSITIONS` and `transition_order_status`) are: `NEW → CONFIRMED | CANCELLED` (rejecting a `NEW` order requires a reason), `CONFIRMED → PREPARING | CANCELLED`, `PREPARING → READY | CANCELLED`, `READY → COMPLETED | CANCELLED`; `COMPLETED` and `CANCELLED` are terminal. Transitioning to `COMPLETED` requires `paid = "paid"` (blocked for `unpaid` or `refunded` orders). Transitioning to `CANCELLED` atomically restores item quantities to product stock. Manual orders transition `NEW → CONFIRMED` on creation, and `READY` orders can be marked paid and `COMPLETED` in one step.
4. **Cash-basis profit:** `Profit = Σ(paid order totals) − Σ(expenses)` over the selected time window in the business timezone (`business_settings.timezone`). Orders carry a `paid` status of `unpaid`, `paid`, or `refunded`: only non-cancelled `paid` orders count toward revenue and profit, attributed to their `paidAt` date in the business timezone (falling back to `updatedAt`, `requestedDate`, or `createdAt`). `unpaid` non-cancelled orders count as pending revenue; `refunded` orders count as neither. Recording a refund (`paid = "refunded"`, setting `refundedAt`) is owner-only, and item contents of `paid`, `refunded`, `COMPLETED`, or `CANCELLED` orders cannot be edited.
5. **Immutable state:** UI state updates use spread/map patterns.
6. **Guest identity & name validation:**
   - **Single canonical name:** Guest names use a single field (`Name` / `Full name`), never split into first/last.
   - **Validation & normalisation (`normalizeGuestName`):**
     - Trim leading/trailing whitespace, collapse internal runs of whitespace (`/\s+/g` → `" "`), and normalise to Unicode NFC.
     - Accept all printable Unicode characters (digits, accented letters, hyphens, apostrophes, periods, and non-Latin scripts). Do not enforce character-class regexes, case rules, word-boundary rules, or auto title-casing (which mangles names like `McDonald` or `van der Berg`).
     - Reject control characters (`U+0000–U+001F`, `U+007F–U+009F`) and lone surrogates (`U+D800–U+DFFF`).
     - Enforce **2 to 50 characters** (measured in Unicode code points after trimming/collapsing whitespace) on the server; client-side checks are UX-only.
   - **Blind find-or-create & anti-enumeration:**
     - Anonymous visitors can _create_ guests and _link_ orders to them by normalised E.164 phone (unique per business), but they can never _read_ or _overwrite_ a canonical guest name (`guests.name`).
     - Only an authenticated manager can overwrite `guests.name`, and only with explicit intent (`updateGuestName: true` after unlocking the prefilled name field). When an unprivileged or unlocked submission supplies a differing name for an existing phone, the canonical `guests.name` is preserved and the differing name is recorded in `orders.submitted_name` for audit.
   - **Single source of truth on orders:** `Order` stores `guestId` (required) and never duplicates `guestName`; UI read-models resolve the guest's current name by joining on `guestId`.
7. **Storefront order limits (`place_order`):**
   - **Requested date & time:** `requestedTime` (when provided) must be at whole minutes. The slot rules below use the business timezone and are enforced by `place_order` and, first, by the Server Action (`validateSlot`); manager (manual) orders are exempt.
     - **Closed shop = scheduled only:** an ASAP order is accepted only while the shop is open; while it is closed, only a scheduled order is possible (`closed_now`). With accepting orders switched off, no order is accepted at all.
     - **Window:** `requestedDate` must fall within `[today, today + 30 days]` (`date_out_of_window`).
     - **Opening hours:** a scheduled date must be an opening day (`closed_day`); a given time must lie inside that day's opening ranges (`time_outside_hours`) and in the future (`time_in_past`). Exceptions (closures or special hours) override the weekly hours for their dates.
     - **No structured hours = no hours check:** when no weekly hours are configured (and no exception covers the date) only the window applies.
   - **Item & quantity caps:** at most 50 lines per order, 50 units per product, and 100 total units per order (after merging duplicate lines).
   - **Rate limits (anonymous callers):** at most 3 orders per 10 minutes per hashed phone number and 120 orders per 10 minutes per business.
   - **Text & availability checks:** delivery address ≤ 300 characters (required for `delivery`), notes ≤ 500 characters, guest name 2–50 characters; business must have `accepting_orders = true` and the chosen service type, payment preference, and minimum order amount satisfied.

Rules 1–3 were found not fully enforced in the legacy code (hard delete, no `CANCELLED` status, silent stock truncation, `customerId` not persisted). The PWA must implement them as specified.

## 6. Domain model

Carried over from the legacy app; the PWA database schema is defined in [`docs/database/schema.md`](database/schema.md).

| Entity              | Fields                                                                                                                                                                                              | Notes                                                                                                                                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Product**         | id, name, price, unitCost, stock, visible, image, categoryId, creationDate, lastUpdateDate                                                                                                          | `unitCost` defaults to 0 in v1; used for margins in v2                                                                                                                                                                                                 |
| **ProductCategory** | id, name                                                                                                                                                                                            | Juice, Yogurt, Bakery (extensible)                                                                                                                                                                                                                     |
| **Customer**        | id, name, phone?, email?, address?, notes?, creationDate                                                                                                                                            | Enables repeat-customer recognition and delivery contact                                                                                                                                                                                               |
| **Order**           | id, guestId, submittedName?, serviceType, channel, status, paid, paymentPreference, paymentMethod?, paidAt?, refundedAt?, requestedDate, requestedTime?, items[], totalAmount, createdAt, updatedAt | Name resolved via `guestId`; statuses: `NEW`, `CONFIRMED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`; `paid`: `paid`, `unpaid`, `refunded`; `paymentMethod`: `cash`, `revolut`, `wero`; `channel`: `storefront`, `phone`, `whatsapp`, `in-person` |
| **OrderItem**       | productId, productName, quantity, unitPrice                                                                                                                                                         | Embedded in Order                                                                                                                                                                                                                                      |
| **Expense**         | id, amount, date, description, tags[]                                                                                                                                                               | Tags: Ingredients, Transport, Equipment, Supplies, Utilities                                                                                                                                                                                           |
| **AppSettings**     | theme, currency, dateFormat, lowStockThreshold, taxPercentage, notifications                                                                                                                        | Storage location in the PWA undecided                                                                                                                                                                                                                  |

Service types: `pickup` and `delivery` (`dine-in` exists only as a stored legacy value in `storedServiceTypeSchema` and the `business_settings.service_types.dineIn` flag).

## 7. Non-functional requirements

- **Performance:** fast first load; storefront pages server-rendered.
- **Accessibility:** WCAG AA, 44px touch targets, high contrast.
- **Platform:** modern mobile and desktop browsers; both the customer storefront and the manager dashboard are installable as separate PWAs with distinct manifests (offline support **Planned**).
- **Security:** authorisation enforced by RLS; no secrets in `NEXT_PUBLIC_*`.

## 8. Known gaps and planned improvements

| Gap                               | Impact                                              | Plan                                          |
| --------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Per-product margins (v2)          | Cash-basis profit hides per-product profitability   | See FinOps strategy below                     |
| Hardcoded reference date (legacy) | KPI engine used a fixed "now" for mock data         | Use the real current date with real data      |
| Offline behaviour                 | Legacy was local-first; PWA offline scope undefined | Design with the service worker work (Planned) |

### FinOps strategy for v2 per-product margins

1. **Tier 1 (static benchmark):** the owner enters an estimated unit cost. Margin = `Price − unitCost`.
2. **Tier 2 (batch allocation):** when logging bulk purchases, the owner optionally tags the batch output (e.g. "$45 flour/butter → 30 sourdough"); `Actual Unit Cost = 45 / 30` updates the product baseline.
3. **Tier 3 (category absorption):** periodic reconciliation: `Total ingredient expenses in category / Total units sold`.

## 9. Roadmap

Delivery is tracked in GitHub: milestone `v0.9 MVP` (staging release), epics and stories ordered by `wave`.

Functional features deferred beyond `v0.9` in the legacy roadmap: per-product margins, batch expense remapping, push notifications, receipt printing.
