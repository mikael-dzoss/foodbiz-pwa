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

| Flow                   | Screens                                                                                                | Stories                      | Status      | Stitch       |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------- | ----------- | ------------ |
| F0 Patterns reference  | Components & states sheet                                                                              | #28, #33, #34                | implemented | see registry |
| F1 Manager shell       | Shell (bottom nav / sidebar), quick-add sheet                                                          | #29                          | brief       | —            |
| F2 Storefront shell    | Shell (header, cart button, footer, language switch)                                                   | #30                          | brief       | —            |
| F3 Auth                | Sign-in, no access                                                                                     | #36, #37, #38, #40           | brief       | see registry |
| F4 Dashboard           | Dashboard                                                                                              | #61, #62, #63                | designed    | see registry |
| F5 Orders              | Orders list, order detail, cancel dialog, payment sheet                                                | #49, #50, #52, #53, #54, #55 | designed    | see registry |
| F6 Manual order        | New order (items, customer, service, payment)                                                          | #51                          | designed    | see registry |
| F7 Catalog             | Products list, product form, categories, stock sheet                                                   | #42–#47                      | brief       | see registry |
| F8 Expenses            | Expenses list, expense sheet                                                                           | #58, #59                     | brief       | —            |
| F9 Settings            | Settings hub, account, business, ordering, payment, inventory & finance, notifications/team/app, about | #68–#74                      | brief       | —            |
| F10 Customers          | Customers list, customer detail                                                                        | #66                          | verified    | see registry |
| F11 Storefront catalog | Home/catalog, product detail, shop closed state, shop info                                             | #80–#83                      | designed    | see registry |
| F12 Checkout           | Cart, checkout, confirmation & payment instructions                                                    | #85, #86, #88, #90           | designed    | see registry |
| F13 Tracking           | Order tracking                                                                                         | #89                          | designed    | see registry |
| F14 Analytics          | Analytics (range, trend, top products, export)                                                         | #76, #77, #78                | brief       | —            |
| F15 System             | 404, error, offline, legal, install prompt                                                             | #34, #97, #100, #101         | brief       | —            |

## Screens

| ID      | Screen                 | Route                               | Purpose                                                                           | Primary action          | Key states                                                 | Flow |
| ------- | ---------------------- | ----------------------------------- | --------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- | ---- |
| P-01    | Patterns reference     | `/patterns` (dev only)              | Anchor for every generation                                                       | —                       | all component states, light/dark                           | F0   |
| M-00    | Manager shell          | `/manage/*`                         | Navigate main areas one-handed                                                    | Add (center)            | active item, Soon items in More                            | F1   |
| M-01    | Quick-add sheet        | sheet                               | Start order / product / expense                                                   | New order               | —                                                          | F1   |
| S-00    | Storefront shell       | `/[locale]/*`                       | Brand, cart, language                                                             | Cart                    | cart empty / count                                         | F2   |
| A-01    | Sign-in                | `/manage/sign-in`                   | Manager sign-in                                                                   | Continue with Google    | loading, error                                             | F3   |
| A-02    | No access              | `/manage/no-access`                 | Explain refusal                                                                   | Sign out                | —                                                          | F3   |
| M-10    | Dashboard              | `/manage`                           | Today at a glance                                                                 | Period picker           | empty day, loading, error                                  | F4   |
| M-20    | Orders list            | `/manage/orders`                    | Triage orders by status                                                           | Open order              | tabs w/ counts, empty, loading                             | F5   |
| M-21    | Order detail           | `/manage/orders/[id]`               | Progress and get paid                                                             | Next status             | unpaid blocks complete, cancelled, web order accept/reject | F5   |
| M-22    | Record payment sheet   | sheet                               | Record cash/Revolut/Wero                                                          | Mark paid               | —                                                          | F5   |
| M-23    | Cancel order dialog    | dialog                              | Confirm cancel, restore stock                                                     | Cancel order            | —                                                          | F5   |
| M-30    | New order              | `/manage/orders/new`                | Fast manual entry                                                                 | Create order            | out of stock, validation                                   | F6   |
| M-40    | Products list          | `/manage/products`                  | Find and manage products                                                          | Add product             | search, filters, hidden, low stock, empty                  | F7   |
| M-41    | Product form           | `/manage/products/[id]`             | Create/edit product                                                               | Save product            | image upload, validation                                   | F7   |
| M-42    | Categories             | `/manage/products/categories`       | Manage categories                                                                 | Add category            | empty, in-use delete                                       | F7   |
| M-43    | Stock adjustment sheet | sheet                               | Adjust stock                                                                      | Save                    | below zero blocked                                         | F7   |
| M-50    | Expenses list          | `/manage/expenses`                  | Track costs                                                                       | Add expense             | period total, tags, empty                                  | F8   |
| M-51    | Expense sheet          | sheet                               | Add/edit/delete                                                                   | Save expense            | validation, delete confirm                                 | F8   |
| M-60    | Settings hub           | `/manage/settings`                  | Reach every section                                                               | —                       | Soon items                                                 | F9   |
| M-61…67 | Settings sections      | `/manage/settings/*`                | Account, business, ordering, payment, inventory & finance, notifications/team/app | Save                    | Soon items                                                 | F9   |
| M-68    | About                  | `/manage/settings/about`            | Version, legal, support                                                           | —                       | —                                                          | F9   |
| M-70    | Customers list         | `/manage/customers`                 | Repeat guests                                                                     | Open customer           | search, empty                                              | F10  |
| M-71    | Customer detail        | `/manage/customers/[id]`            | History and contact                                                               | Call / message          | —                                                          | F10  |
| C-01    | Storefront home        | `/[locale]`                         | Browse catalog                                                                    | Add to cart             | categories, out of stock, shop closed                      | F11  |
| C-02    | Product detail         | `/[locale]/p/[slug]`                | Decide and add                                                                    | Add to cart             | quantity, unavailable                                      | F11  |
| C-03    | Shop info              | `/[locale]/info`                    | Hours, contact, area                                                              | Call / directions       | no hours set                                               | F11  |
| C-10    | Cart                   | `/[locale]/cart`                    | Review order                                                                      | Checkout                | empty, stock changed                                       | F12  |
| C-11    | Checkout               | `/[locale]/checkout`                | Guest details, pickup/delivery, time, payment preference                          | Place order             | validation, ASAP vs scheduled, submitting                  | F12  |
| C-12    | Confirmation           | `/[locale]/order/[token]/confirmed` | Payment instructions                                                              | Copy revtag / open Wero | Revolut, Wero, pay on handover                             | F12  |
| C-20    | Order tracking         | `/[locale]/order/[token]`           | Follow status                                                                     | Contact shop            | each status, cancelled                                     | F13  |
| M-80    | Analytics              | `/manage/analytics`                 | Trends and top products                                                           | Export CSV              | range, empty, loading                                      | F14  |
| X-01    | Not found              | both groups                         | Recover                                                                           | Go home                 | —                                                          | F15  |
| X-02    | Error                  | both groups                         | Recover                                                                           | Retry                   | —                                                          | F15  |
| X-03    | Offline                | both groups                         | Explain, show cached data                                                         | Retry                   | —                                                          | F15  |
| X-04    | Legal                  | `/[locale]/legal/*`                 | Terms, privacy                                                                    | —                       | —                                                          | F15  |
| X-05    | Install prompt         | manager                             | Install PWA                                                                       | Install                 | dismissed                                                  | F15  |

## Active Stitch screens

One active screen per screen and mode. Any other Stitch card is superseded: list it here until the owner deletes it in Stitch. Rules: [`DESIGN_SYSTEM.md` §11](DESIGN_SYSTEM.md#working-with-stitch-agents).

| Screen                   | Light (active)                     | Dark (active)                      | Superseded (to delete)                                  |
| ------------------------ | ---------------------------------- | ---------------------------------- | ------------------------------------------------------- |
| P-01 Patterns reference  | `4b89d3e37632415da28bd4ed0fab6456` | `0d3d1062fa27420e908bebabfc162f05` | —                                                       |
| A-01 Manager sign-in     | `2ecaa23a39124534acdd75f8e94d8dba` | `d8e6f205ffe4444087e4476302a94fbb` | —                                                       |
| M-10 Dashboard           | `78b27e2e5b6f41faa8620dfe49daf4d8` | `5063b1f378cb4d4aaea5ffc6f3b0d148` | —                                                       |
| M-20 Orders list         | `85cd53be973444dcbdff77c6124da920` | `6a21269a11db485188c3a556a930cbcf` | —                                                       |
| M-21 Order detail        | `dd6b7a8e57994a808b4bb091dc366d0e` | `b8414f3cda494766b6b6dfebdb796961` | —                                                       |
| M-30 New order           | `a9730928a6cd4a448907b4cd55d3f03d` | `b91d3b2fb2af416aacb2c4cc1a015ffe` | —                                                       |
| M-40 Products list       | `b45ce7634bf84c92949a79411887e2bc` | `d85df903d3114fc6b1705a6cd8de2244` | —                                                       |
| M-41 Product form        | `096f7f6b9222407caa87e483cc1de8bf` | `0dbc6481c8244d9a88b78fb8ef819124` | —                                                       |
| M-42 Categories          | `b151c3cdb7934d38ae7c5c19ffb1c4d1` | `ad0cdf5ebcd646c79a4808c52582fd35` | —                                                       |
| M-43 Stock adjustment    | `c74519cfa4064318b2726a958fe5bedf` | `08a0258259cb44e88adf8bd68913cfde` | —                                                       |
| M-50 Expenses list       | `251415a589154a9e92e0e250f6eb8976` | `969886d60bb642619532a2bab9344df6` | —                                                       |
| M-51 Expense sheet       | `b94ec8d1081247d7b7453a34110ec32f` | `973623bb8eb3456583c7e39bf13ee8e3` | —                                                       |
| M-60 Settings hub        | `6e8ffc50ac7c4811b656ef660a024e9f` | `39826731f08b48bb9c77481a2fd53f11` | —                                                       |
| M-61 Account section     | `bfc76ad7c1614f5b9238da67a6310910` | `dc62c013cf5b46019408cbf09df9b4f2` | —                                                       |
| M-62 Business profile    | `ea7f25f130ac435c97189a109f4fa833` | `e36913afc5404a63babe254e31b241d5` | —                                                       |
| M-63 Ordering settings   | `46c2f6a34b44457595003154aee0bcdc` | `3a9a481af1954700bc75109ec7aaa1ed` | —                                                       |
| M-64 Payment settings    | `466a1d7f374942e9895e789831633b69` | `5f6c2683efbf46e48baa48a2b909ed93` | —                                                       |
| M-65 Inventory & finance | `6988aebd933e47bda20be9ec53adc21d` | `aded4036b64f473cb6b8ecaa408d1518` | —                                                       |
| M-67 Notifications & app | `8ee29f8193974f6089b549ea3e13114e` | `016523a07f9c4ee5b8987b58a552e981` | —                                                       |
| M-70 Customers list      | `e7ecfb1ddb65480099a05b44683ce239` | `c02a041e162045c8a1c381feb1cf0d6f` | —                                                       |
| M-71 Customer detail     | `f71153b9f4e441adafc8610a8fcd7867` | `822b2692324546cf9e05cd7edea2a3ed` | `01e712f983ba43658ec5d408f89ddb0e` (bottom nav removed) |
| C-01 Storefront home     | `f7ad34729a9749f8bdcd5f284d6693f2` | —                                  | —                                                       |
| C-02 Product detail      | `9204ca8308d64d1fb0cdffdceb556ca3` | —                                  | —                                                       |
| C-03 Shop info           | `938e3829952c47c0bba19080058b1a4e` | —                                  | —                                                       |
| C-10 Cart                | `2b3b671392964f58848147148e39bba6` | `327a8059951745bb9bf84edde773924a` | —                                                       |
| C-11 Checkout            | `ad3a1b405b404ca78366ed1c8297cc95` | `877f2e4892a34808938b09103ea108c4` | —                                                       |
| C-20 Order tracking      | `2b5aa769f2f54703bc7f21206a36867e` | `ff98b79d1c504a0f8fbf3b67ae2f43b1` | —                                                       |

## Customer behaviour (#66)

`/manage/customers` searches canonical names and phone numbers, lists all-order counts and the latest order creation date, and sums paid, non-cancelled, non-refunded orders for total spent (matching cash-basis KPI rules). Lists and histories initially render 20 entries with a "Show more" action. Detail resolves orders by `guestId`, displays differing `submittedName` values as "Ordered as …", and supports canonical-name edits, private notes (2,000 characters), call and WhatsApp links. Names are validated with the shared guest schema; all reads and edits are scoped to the authenticated business. Renaming never rewrites historical order audit fields. Uses the existing repository adapter; Supabase persistence remains part of the repository integration work.

The light canvas references were inspected with `get_screen`; dark styling derives from shared tokens. Browser screenshots and WCAG AA checks cover both routes in EN/FR, light/dark, at 360 px.

The M-70 visual contract is a compact app bar with a live customer count, search and result/sort metadata, and one divided directory surface: identity and order/date metadata on the left, spend and chevron on the right. M-71 uses an initials avatar identity card, separate three-column KPI tiles, an internal profile form with a full-width save action, and history cards with status/payment badges, fulfillment, quantities, audit-name annotations and view affordances. Loading skeletons mirror these compositions. Browser checks cover the compact row geometry at 360 and 390 px as well as functional and accessibility regressions.

Keep the model's visual hierarchy, spacing and surfaces, but omit model-only screen IDs, the unsupported "Regular" classification, POS/invoice claims and the empty-state preview control. Customer totals and history counts are live; notes and spend helper copy describe only implemented behavior. Input outlines retain the design system's accessible control token rather than the model's low-contrast decorative borders.

Customer detail uses the top back link without the manager bottom navigation, consistent with order detail. Any bottom navigation added by a generated detail reference is noise, not a requirement.

## Gaps

- **Living style guide route**: Implemented at `/patterns` (dev-only) with reusable components inventory and documentation in [`COMPONENTS.md`](COMPONENTS.md).
- **Theme switch** (system/light/dark): Implemented via `ThemeProvider`, `ThemeScript`, and `@theme` tokens in `src/app/globals.css`. Control integrated on `/patterns` toolbar.
