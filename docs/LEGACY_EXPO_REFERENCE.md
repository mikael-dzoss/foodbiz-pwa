# Legacy Expo Project Reference

This document provides a high-level overview of the UI architecture, styling conventions, and partially/fully implemented functionalities in the original React Native Expo `foodbiz-manager` application. The purpose of this guide is to provide AI coding agents with the exact state of what was already built so that the new PWA migration stays aligned with the original vision and functionality without having to constantly scan the legacy codebase.

## 1. UI Architecture & Routing

The original project relies on `@react-navigation` to structure its views.

### Navigation Hierarchy (`RootNavigator.tsx`)

The app uses a `DrawerNavigator` at the root which wraps two main navigation groups:

- **AppTabs (Bottom Tabs):**
  - **Dashboard:** Main landing page, displays Key Performance Indicators (KPIs).
  - **Orders:** Sales and order lifecycle management.
  - **Add:** A placeholder/FAB tab meant for quick-add actions.
  - **Inventory:** Maps to `ProductsScreen`, handles the product catalog.
  - **Analytics:** Data visualization and financial trends.
- **MoreStack (Native Stack):**
  - **Account:** User profile management.
  - **Information:** System diagnostics, legal info, etc.
  - **Settings:** App configuration and user preferences.
- **AuthStack:**
  - **SignInScreen:** The standalone authentication screen, distinct from the main app flow.

### Modals

Several functionalities were split out into Bottom Sheet-style modals, originally utilizing spring animations and swipe-to-dismiss patterns:

- `AddEditProductModal`: Form for creating or modifying inventory products.
- `EditExpenseModal`: Form for logging or modifying financial expenses.

## 2. Aesthetics & Design Tokens

The app follows a "Corporate Modern meets Minimalist Warmth" design language.

### Styling System

All UI components use strictly managed design tokens imported from `src/app/theme/index.ts`. No inline styles or hardcoded hex values are used.

- **Brand Colors:**
  - **Primary:** Forest Green (`#006c49`) - used for Profit / Success Actions.
  - **Secondary:** Warm Amber/Brown (`#855300`) - used for Sales / Tactical Highlights.
  - **Tertiary:** Accent Blue (`#005ac2`) - used for Information / Navigational Accents.
  - **Backgrounds:** `#f9f9ff` with layered surface containers (`surfaceContainerLow`, etc.).
- **Typography:**
  - **Headings & Display:** Manrope (e.g., `Manrope_700Bold`).
  - **Body Text:** Inter (e.g., `Inter_400Regular`).
  - **System / Numbers:** JetBrains Mono (e.g., `JetBrainsMono_500Medium`), widely used for KPIs and tabulated financial data.

## 3. Implemented Functionalities & Logics

The original project implemented a fully client-side architecture using React Context, TanStack Query, and `AsyncStorage` (in preparation for a future Supabase migration).

### State Management & Entities

- **StoreContext (`src/lib/store/StoreContext.tsx`):** The central state hub. Holds the mock/cached data and provides mutation handlers (`handleSaveOrder`, `handleSaveProduct`, `handleSaveExpense`, etc.).
- **Data Models (`src/domain/models.ts` using `zod`):**
  - **Products:** Defined with `id`, `name`, `price`, `unitCost`, `stock`, `visible`, `image`, and `categoryId`.
  - **Orders:** Tied to `OrderStatus` (`PREPARING`, `READY`, `COMPLETED`, etc.) and `ServiceType` (`Dine-in`, `Pickup`, `Takeaway`, `Delivery`). Contains `OrderItem`s which map back to products.
  - **Expenses:** Simple ledger entries used to track operating costs.
  - **Customers & Categories:** Scaffolded as basic entities.
- **KPI Logic (`src/domain/kpis.ts`):** Calculates cash basis Key Performance Indicators. Combines total `revenue` (from Orders) and total `cost` (from Expenses) to yield `profit` over configurable `daysRange` periods.

### Authentication (`src/lib/auth/AuthContext.tsx`)

- **Google OAuth / Allow-list Strategy:** The `SignInScreen` checks users against a predefined list of allowed emails or logs them in using Google OAuth (using an Expo plugin integration).
- **Session:** Bootstraps auth state from `AsyncStorage` and stores a basic `AppUser` profile.

---

**Note to Agents:**
When migrating these concepts to the Next.js 16 PWA, remember that:

- Navigation will move to Next.js App Router (`app/(dashboard)/...`).
- Global state and TanStack Query caches should be replaced by React Server Components, Server Actions, and Supabase SSR integration.
- The aesthetic tokens should be translated into the Tailwind `globals.css` `@theme` block.
