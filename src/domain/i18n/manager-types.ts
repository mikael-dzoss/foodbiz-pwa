import type { CategoriesDictionary } from "./areas/categories";
import type { ExpensesDictionary } from "./areas/expenses";
import type { OrdersDictionary } from "./areas/orders";
import type { ProductsAdminDictionary } from "./areas/products-admin";
import type { SettingsExtraDictionary } from "./areas/settings-extra";

export type {
  CategoriesDictionary,
  ExpensesDictionary,
  OrdersDictionary,
  ProductsAdminDictionary,
  SettingsExtraDictionary,
};

/** Manager dashboard copy beyond the shared namespaces in `types.ts` (every key required in each locale). */

export interface ManagerShellDictionary {
  brandRole: string;
  desktopNavLabel: string;
  mobileNavLabel: string;
  categories: string;
  signOut: string;
  soon: string;
  comingSoon: string;
  comingSoonToast: string;
  moreTitle: string;
  moreDescription: string;
  moreItems: {
    categories: string;
    expenses: string;
    customers: string;
    analytics: string;
    settings: string;
  };
  /** Titles of the "coming soon" rows shown in the manager (see `domain/features`). */
  features: Record<
    | "settings.team"
    | "account.devices"
    | "account.export_data"
    | "account.delete"
    | "business.cover_image"
    | "business.brand_color"
    | "business.logo"
    | "legal.terms"
    | "legal.privacy"
    | "analytics.dashboard",
    { title: string; description: string }
  >;
  quickAddDescriptions: {
    order: string;
    product: string;
    expense: string;
  };
  /** Page-level `<title>` and `<meta name="description">` strings for the manager area. */
  meta: {
    appDescription: string;
    dashboardDescription: string;
    ordersDescription: string;
    newOrderDescription: string;
    orderDetailTitle: string;
    orderDetailDescription: string;
    customerDetailTitle: string;
    customerDetailDescription: string;
  };
}

export interface LoginDictionary {
  pageHeading: string;
  backToStorefront: string;
  portalBadge: string;
  welcome: string;
  intro: string;
  developmentDivider: string;
  demoSignIn: string;
  restricted: string;
  footer: string;
}

export interface ManagerExtras {
  manager: ManagerShellDictionary;
  login: LoginDictionary;
  orders: OrdersDictionary;
  expenses: ExpensesDictionary;
  productsAdmin: ProductsAdminDictionary;
  categories: CategoriesDictionary;
  settingsExtra: SettingsExtraDictionary;
  // @@TYPES@@
}
