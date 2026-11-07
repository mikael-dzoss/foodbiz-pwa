/** Static app metadata shared by the root layout and the web app manifest. */
export const APP_METADATA = {
  name: "FoodBiz Manager",
  shortName: "FoodBiz",
  description: "Run your food business: orders, products, expenses and an online storefront.",
  themeColor: "#0f766e",
  backgroundColor: "#ffffff",
} as const;

/**
 * Whether public legal routes (`/[locale]/legal/privacy`, `/[locale]/legal/terms`) exist.
 * TODO(#97): Set to true once legal pages are implemented.
 */
export const LEGAL_PAGES_AVAILABLE = false;
