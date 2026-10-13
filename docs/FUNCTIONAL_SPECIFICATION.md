# FoodBiz PWA — Functional Specification

Carried over from the legacy FoodBiz Manager mobile app and extended with the customer storefront. **Status:** the PWA is at the initial scaffold; every module below is **Planned** unless stated otherwise. Legacy status is noted for reference only.

## 1. Product vision

A web app for small, part-time food business owners (home bakers, meal prep, food trucks) to replace scattered spreadsheets and notebooks, plus an online storefront where their customers browse products and order.

**Design philosophy:** radical accessibility through minimal friction.

- **Mobile-first:** single-hand workflows, 44px+ touch targets, clean layouts.
- **One screen away:** the dashboard surfaces key metrics.
- **Zero jargon:** "Revenue", "Costs", "Net Profit" — plain terms only.

**Target manager:** solo operator, 10–50 products, 5–30 orders/day, needs quick data entry between cooking and serving.

## 2. Roles

| Role         | Surface                        | Capabilities (Planned)                                               |
| ------------ | ------------------------------ | -------------------------------------------------------------------- |
| **Manager**  | Dashboard (installable PWA)    | Manage products, orders, expenses; view dashboard and analytics      |
| **Customer** | Storefront (SSR, SEO-friendly) | Browse visible products, place orders without app-store installation |

Data segregation between roles is enforced with Supabase Row Level Security (see [`architecture.md`](architecture.md)). The exact customer sign-in/checkout flow is not yet defined.

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

## 4. Customer storefront (new, Planned)

- Public catalog of **visible** products with price, image and category, rendered server-side for SEO.
- Product availability reflects stock.
- Customers can place an order from a URL; the order is linked to a `Customer` record and appears in the manager's orders list.
- Installation is optional; the storefront must work in a plain browser.

Open questions (undecided): customer accounts vs guest checkout, payment handling, order notifications.

## 5. Core business rules

1. **Negative inventory prevention:** checkout decrements stock; stock cannot go below zero. Orders exceeding stock must be blocked or flagged, not silently truncated.
2. **Soft deletion:** products are hidden (`visible = false`), never permanently deleted, to protect historical order references.
3. **Order lifecycle:** `Preparing → Ready → Completed/Delivered`; `Cancelled` allowed from any pre-delivery state, with validated transitions.
4. **Cash-basis profit:** `Profit = Σ(order totals) − Σ(expenses)` over the selected time window.
5. **Immutable state:** UI state updates use spread/map patterns.

Rules 1–3 were found not fully enforced in the legacy code (hard delete, no `CANCELLED` status, silent stock truncation, `customerId` not persisted). The PWA must implement them as specified.

## 6. Domain model

Carried over from the legacy app; the PWA database schema is defined in [`docs/database/schema.md`](database/schema.md).

| Entity              | Fields                                                                                       | Notes                                                             |
| ------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Product**         | id, name, price, unitCost, stock, visible, image, categoryId, creationDate, lastUpdateDate   | `unitCost` defaults to 0 in v1; used for margins in v2            |
| **ProductCategory** | id, name                                                                                     | Juice, Yogurt, Bakery (extensible)                                |
| **Customer**        | id, name, phone?, email?, address?, notes?, creationDate                                     | Enables repeat-customer recognition and delivery contact          |
| **Order**           | id, customerId?, customerName, serviceType, channel, timestamp, status, items[], totalAmount | Statuses: PREPARING, READY, COMPLETED, CONFIRMED, PAID, DELIVERED |
| **OrderItem**       | productId, productName, quantity, unitPrice                                                  | Embedded in Order                                                 |
| **Expense**         | id, amount, date, description, tags[]                                                        | Tags: Ingredients, Transport, Equipment, Supplies, Utilities      |
| **AppSettings**     | theme, currency, dateFormat, lowStockThreshold, taxPercentage, notifications                 | Storage location in the PWA undecided                             |

Service types: Dine-in, Pickup, Takeaway, Delivery.

## 7. Non-functional requirements

- **Performance:** fast first load; storefront pages server-rendered.
- **Accessibility:** WCAG AA, 44px touch targets, high contrast.
- **Platform:** modern mobile and desktop browsers; manager dashboard installable as a PWA (manifest implemented; offline support **Planned**).
- **Security:** authorisation enforced by RLS; no secrets in `NEXT_PUBLIC_*`.

## 8. Known gaps and planned improvements

| Gap                               | Impact                                              | Plan                                          |
| --------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Per-product margins (v2)          | Cash-basis profit hides per-product profitability   | See FinOps strategy below                     |
| No payment tracking               | No `paymentMethod` or `paidAt` on orders            | Add payment fields (cash/card/mobile)         |
| Hardcoded reference date (legacy) | KPI engine used a fixed "now" for mock data         | Use the real current date with real data      |
| Offline behaviour                 | Legacy was local-first; PWA offline scope undefined | Design with the service worker work (Planned) |

### FinOps strategy for v2 per-product margins

1. **Tier 1 (static benchmark):** the owner enters an estimated unit cost. Margin = `Price − unitCost`.
2. **Tier 2 (batch allocation):** when logging bulk purchases, the owner optionally tags the batch output (e.g. "$45 flour/butter → 30 sourdough"); `Actual Unit Cost = 45 / 30` updates the product baseline.
3. **Tier 3 (category absorption):** periodic reconciliation: `Total ingredient expenses in category / Total units sold`.

## 9. Roadmap

Delivery is tracked in GitHub: milestone `v0.9 MVP` (staging release), epics and stories ordered by `wave`.

Functional features deferred beyond `v0.9` in the legacy roadmap: per-product margins, batch expense remapping, push notifications, receipt printing.
