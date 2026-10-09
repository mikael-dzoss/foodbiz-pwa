# Screen Inventory

Every v0.9 screen, grouped into **flows** — the unit of the design → implement loop. Tokens and patterns: [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

**Status:** `brief` → `designed` (Stitch light + dark) → `approved` (owner) → `implemented` (PR) → `verified` (screenshots light/dark, EN/FR, a11y checks pass).

Routes are proposals until #31 (i18n) settles routing: storefront under `/[locale]` (SEO), manager under `/manage` (locale from user preference).

## Loop per flow

1. Brief in this file (goal, content, primary action, states, EN/FR copy).
2. Generate in Stitch (mobile) with the **light** design system, using only patterns from F0; produce the **dark** version with the dark design system. Fix with `edit_screens`.
3. Owner approval.
4. Rebuild with our components and tokens (Stitch HTML is reference only); one PR per story, `design-change` gate.
5. Playwright screenshots (light/dark × EN/FR) compared to the Stitch frames; update Stitch if the implementation intentionally differs; status → `verified`.

New pattern needed by a screen → add it to F0 and the component inventory first.

## Flows

| Flow | Screens | Stories | Status | Stitch |
| --- | --- | --- | --- | --- |
| F0 Patterns reference | Components & states sheet | #28, #33, #34 | designed | see registry |
| F1 Manager shell | Shell (bottom nav / sidebar), quick-add sheet | #29 | brief | — |
| F2 Storefront shell | Shell (header, cart button, footer, language switch) | #30 | brief | — |
| F3 Auth | Sign-in, no access | #36, #37, #38, #40 | brief | — |
| F4 Dashboard | Dashboard | #61, #62, #63 | brief | — |
| F5 Orders | Orders list, order detail, cancel dialog, payment sheet | #49, #50, #52, #53, #54, #55 | brief | — |
| F6 Manual order | New order (items, customer, service, payment) | #51 | brief | — |
| F7 Catalog | Products list, product form, categories, stock sheet | #42–#47 | brief | — |
| F8 Expenses | Expenses list, expense sheet | #58, #59 | brief | — |
| F9 Settings | Settings hub, account, business, ordering, payment, inventory & finance, notifications/team/app, about | #68–#74 | brief | — |
| F10 Customers | Customers list, customer detail | #66 | brief | — |
| F11 Storefront catalog | Home/catalog, product detail, shop closed state, shop info | #80–#83 | brief | — |
| F12 Checkout | Cart, checkout, confirmation & payment instructions | #85, #86, #88, #90 | brief | — |
| F13 Tracking | Order tracking | #89 | brief | — |
| F14 Analytics | Analytics (range, trend, top products, export) | #76, #77, #78 | brief | — |
| F15 System | 404, error, offline, legal, install prompt | #34, #97, #100, #101 | brief | — |

## Screens

| ID | Screen | Route | Purpose | Primary action | Key states | Flow |
| --- | --- | --- | --- | --- | --- | --- |
| P-01 | Patterns reference | dev only | Anchor for every generation | — | all component states, light/dark | F0 |
| M-00 | Manager shell | `/manage/*` | Navigate main areas one-handed | Add (center) | active item, Soon items in More | F1 |
| M-01 | Quick-add sheet | sheet | Start order / product / expense | New order | — | F1 |
| S-00 | Storefront shell | `/[locale]/*` | Brand, cart, language | Cart | cart empty / count | F2 |
| A-01 | Sign-in | `/manage/sign-in` | Manager sign-in | Continue with Google | loading, error | F3 |
| A-02 | No access | `/manage/no-access` | Explain refusal | Sign out | — | F3 |
| M-10 | Dashboard | `/manage` | Today at a glance | Period picker | empty day, loading, error | F4 |
| M-20 | Orders list | `/manage/orders` | Triage orders by status | Open order | tabs w/ counts, empty, loading | F5 |
| M-21 | Order detail | `/manage/orders/[id]` | Progress and get paid | Next status | unpaid blocks complete, cancelled, web order accept/reject | F5 |
| M-22 | Record payment sheet | sheet | Record cash/Revolut/Wero | Mark paid | — | F5 |
| M-23 | Cancel order dialog | dialog | Confirm cancel, restore stock | Cancel order | — | F5 |
| M-30 | New order | `/manage/orders/new` | Fast manual entry | Create order | out of stock, validation | F6 |
| M-40 | Products list | `/manage/products` | Find and manage products | Add product | search, filters, hidden, low stock, empty | F7 |
| M-41 | Product form | `/manage/products/[id]` | Create/edit product | Save product | image upload, validation | F7 |
| M-42 | Categories | `/manage/products/categories` | Manage categories | Add category | empty, in-use delete | F7 |
| M-43 | Stock adjustment sheet | sheet | Adjust stock | Save | below zero blocked | F7 |
| M-50 | Expenses list | `/manage/expenses` | Track costs | Add expense | period total, tags, empty | F8 |
| M-51 | Expense sheet | sheet | Add/edit/delete | Save expense | validation, delete confirm | F8 |
| M-60 | Settings hub | `/manage/settings` | Reach every section | — | Soon items | F9 |
| M-61…67 | Settings sections | `/manage/settings/*` | Account, business, ordering, payment, inventory & finance, notifications/team/app | Save | Soon items | F9 |
| M-68 | About | `/manage/settings/about` | Version, legal, support | — | — | F9 |
| M-70 | Customers list | `/manage/customers` | Repeat guests | Open customer | search, empty | F10 |
| M-71 | Customer detail | `/manage/customers/[id]` | History and contact | Call / message | — | F10 |
| C-01 | Storefront home | `/[locale]` | Browse catalog | Add to cart | categories, out of stock, shop closed | F11 |
| C-02 | Product detail | `/[locale]/p/[slug]` | Decide and add | Add to cart | quantity, unavailable | F11 |
| C-03 | Shop info | `/[locale]/info` | Hours, contact, area | Call / directions | no hours set | F11 |
| C-10 | Cart | `/[locale]/cart` | Review order | Checkout | empty, stock changed | F12 |
| C-11 | Checkout | `/[locale]/checkout` | Guest details, pickup/delivery, time, payment preference | Place order | validation, ASAP vs scheduled, submitting | F12 |
| C-12 | Confirmation | `/[locale]/order/[token]/confirmed` | Payment instructions | Copy revtag / open Wero | Revolut, Wero, pay on handover | F12 |
| C-20 | Order tracking | `/[locale]/order/[token]` | Follow status | Contact shop | each status, cancelled | F13 |
| M-80 | Analytics | `/manage/analytics` | Trends and top products | Export CSV | range, empty, loading | F14 |
| X-01 | Not found | both groups | Recover | Go home | — | F15 |
| X-02 | Error | both groups | Recover | Retry | — | F15 |
| X-03 | Offline | both groups | Explain, show cached data | Retry | — | F15 |
| X-04 | Legal | `/[locale]/legal/*` | Terms, privacy | — | — | F15 |
| X-05 | Install prompt | manager | Install PWA | Install | dismissed | F15 |

## Active Stitch screens

One active screen per screen and mode. Any other Stitch card is superseded: list it here until the owner deletes it in Stitch. Rules: [`DESIGN_SYSTEM.md` §11](DESIGN_SYSTEM.md#working-with-stitch-agents).

| Screen | Light (active) | Dark (active) | Superseded (to delete) |
| --- | --- | --- | --- |
| P-01 Patterns reference | `4b89d3e37632415da28bd4ed0fab6456` | `0d3d1062fa27420e908bebabfc162f05` | — |

## Gaps

- **Living style guide route** (dev-only, renders P-01 with real components + Playwright screenshot script): no backlog story yet — propose with the issue-logger script (dry run) before implementing.
- **Theme switch** (system/light/dark): covered by #26 acceptance criteria; its control lives in M-60/M-61 and the storefront footer.
