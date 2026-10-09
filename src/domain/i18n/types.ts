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

export interface CommonDictionary {
  close: string;
  save: string;
  cancel: string;
  loading: string;
  error: string;
  retry: string;
  back: string;
}

export interface Dictionary {
  locale: SupportedLocale;
  nav: NavigationDictionary;
  storefront: StorefrontDictionary;
  quickAdd: QuickAddDictionary;
  common: CommonDictionary;
}
