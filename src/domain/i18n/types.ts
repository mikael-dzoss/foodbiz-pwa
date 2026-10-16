export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "en";

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

export interface NavigationDictionary {
  dashboard: string;
  orders: string;
  add: string;
  products: string;
  expenses: string;
  customers: string;
  analytics: string;
  settings: string;
  more: string;
}

export interface StorefrontDictionary {
  cart: string;
  cartEmpty: string;
  item: string;
  items: string;
  switchLanguage: string;
  contact: string;
  legal: string;
  terms: string;
  privacy: string;
  openHours: string;
}

export interface QuickAddDictionary {
  title: string;
  description: string;
  newOrder: string;
  newProduct: string;
  newExpense: string;
}

export interface DashboardDictionary {
  title: string;
  subtitle: string;
  activeStatus: string;
  periods: {
    today: string;
    last_7_days: string;
    last_30_days: string;
    this_month: string;
  };
  kpi: {
    revenue: string;
    costs: string;
    profit: string;
    orders: string;
    averageOrderValue: string;
    vsPreviousPeriod: string;
    vsYesterday: string;
  };
  triage: {
    sectionTitle: string;
    realtimeAlerts: string;
    toPrepare: string;
    toPrepareCount: string;
    viewAllPrepOrders: string;
    noOrdersToPrepare: string;
    unpaidOrders: string;
    unpaidOrdersCount: string;
    reviewUnpaidOrders: string;
    noUnpaidOrders: string;
    lowStockAlert: string;
    lowStockCount: string;
    manageInventory: string;
    allStockHealthy: string;
    unitsLeft: string;
  };
  activity: {
    sectionTitle: string;
    viewAll: string;
    empty: string;
    paid: string;
    unpaid: string;
    expense: string;
  };
}

export interface CommonDictionary {
  close: string;
  save: string;
  cancel: string;
  loading: string;
  error: string;
  retry: string;
  back: string;
}

export interface SettingsDictionary {
  title: string;
  subtitle: string;
  coreSection: string;
  operationsSection: string;
  systemSection: string;
  account: {
    title: string;
    description: string;
    profileTitle: string;
    managedViaGoogle: string;
    preferencesTitle: string;
    languageLabel: string;
    themeLabel: string;
    themeSystem: string;
    themeLight: string;
    themeDark: string;
    securityTitle: string;
    signOut: string;
  };
  business: {
    title: string;
    description: string;
    identitySection: string;
    logoLabel: string;
    uploadLogo: string;
    nameLabel: string;
    namePlaceholder: string;
    descLabel: string;
    descPlaceholder: string;
    slugLabel: string;
    slugHelper: string;
    activeBadge: string;
    contactSection: string;
    phoneLabel: string;
    emailLabel: string;
    whatsappLabel: string;
    addressLabel: string;
    brandingSection: string;
    saveButton: string;
    saveSuccess: string;
    discardButton: string;
  };
  about: {
    title: string;
    version: string;
    legal: string;
    support: string;
  };
}

export interface Dictionary {
  locale: SupportedLocale;
  nav: NavigationDictionary;
  dashboard: DashboardDictionary;
  storefront: StorefrontDictionary;
  quickAdd: QuickAddDictionary;
  settings: SettingsDictionary;
  common: CommonDictionary;
}
