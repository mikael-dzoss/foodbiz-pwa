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
    /**
     * No trailing slash: scope matching is a path prefix, so `/manage/` would leave `start_url`
     * `/manage` out of scope and browsers would ignore the scope. `/auth/callback` is out of
     * scope but only redirects back to `/manage`, so the OAuth round trip still lands in-app.
     */
    scope: "/manage",
    manifestPath: "/manage/manifest.webmanifest",
  },
  storefront: {
    defaultName: "FoodBiz",
    /** One storefront app for every locale; `start_url` is `/{locale}` (see storefrontManifestPath). */
    manifestId: "/",
    /**
     * Contains `/manage`, which is fine: scopes nest and the more specific manager scope wins for
     * an installed manager app. The storefront no longer links to `/manage`.
     */
    scope: "/",
    dir: "ltr",
  },
} as const;

/** URL of the storefront web app manifest for a locale (served by `[locale]/manifest.webmanifest`). */
export function storefrontManifestPath(locale: string): string {
  return `/${locale}/manifest.webmanifest`;
}

/**
 * Whether public legal routes (`/[locale]/legal/privacy`, `/[locale]/legal/terms`) exist.
 * TODO(#97): Set to true once legal pages are implemented.
 */
export const LEGAL_PAGES_AVAILABLE = false;
