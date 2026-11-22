/** Static app metadata shared by the root layout and the web app manifest. */
export const APP_METADATA = {
  name: "FoodBiz Manager",
  shortName: "FoodBiz",
  description: "Run your food business: orders, products, expenses and an online storefront.",
  /** Light/dark `--background` from globals.css: the browser chrome blends into the app surface. */
  themeColor: "#f9f9ff",
  themeColorDark: "#0f1417",
  backgroundColor: "#f9f9ff",
  /** The installable PWA is the manager app; the storefront stays a normal website. */
  manifestId: "/manage",
  startUrl: "/manage",
  scope: "/",
} as const;

/**
 * Whether public legal routes (`/[locale]/legal/privacy`, `/[locale]/legal/terms`) exist.
 * TODO(#97): Set to true once legal pages are implemented.
 */
export const LEGAL_PAGES_AVAILABLE = false;
