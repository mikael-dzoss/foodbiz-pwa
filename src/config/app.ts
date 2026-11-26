import type { MetadataRoute } from "next";

const MANIFEST_ICONS = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  {
    src: "/icons/icon-maskable-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
  { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
] as const satisfies ReadonlyArray<NonNullable<MetadataRoute.Manifest["icons"]>[number]>;

/**
 * Static app metadata split into shared PWA chrome/icons, manager-app identity, and storefront
 * defaults so both surfaces install as distinct PWAs while reusing the same colours and icons.
 */
export const APP_METADATA = {
  /** Light/dark `--background` from globals.css: the browser chrome blends into the app surface. */
  themeColor: "#f9f9ff",
  themeColorDark: "#0f1417",
  backgroundColor: "#f9f9ff",
  display: "standalone",
  orientation: "portrait",
  icons: MANIFEST_ICONS,
  manager: {
    name: "FoodBiz Manager",
    shortName: "FoodBiz",
    description: "Run your food business: orders, products, expenses and an online storefront.",
    /** Unchanged so existing manager installs update in place. */
    manifestId: "/manage",
    startUrl: "/manage",
    scope: "/manage/",
    manifestPath: "/manage/manifest.webmanifest",
  },
  storefront: {
    defaultName: "FoodBiz",
    manifestId: "/",
    scope: "/",
    dir: "ltr",
  },
} as const;

/**
 * Whether public legal routes (`/[locale]/legal/privacy`, `/[locale]/legal/terms`) exist.
 * TODO(#97): Set to true once legal pages are implemented.
 */
export const LEGAL_PAGES_AVAILABLE = false;
