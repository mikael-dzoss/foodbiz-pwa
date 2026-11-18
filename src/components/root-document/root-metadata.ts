import type { Metadata, Viewport } from "next";
import { APP_METADATA } from "@/config/app";
import { getSiteUrl } from "@/config/site-url";

// No title template here: each area (`/[locale]` storefront, `/manage`) owns its own, so a page
// title is never suffixed twice.
export const rootMetadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: APP_METADATA.name,
  description: APP_METADATA.description,
  applicationName: APP_METADATA.name,
  appleWebApp: { capable: true, title: APP_METADATA.shortName, statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const rootViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_METADATA.themeColor },
    { media: "(prefers-color-scheme: dark)", color: APP_METADATA.themeColorDark },
  ],
  width: "device-width",
  initialScale: 1,
  // Without `cover` every env(safe-area-inset-*) resolves to 0, so bars sit under the home indicator.
  viewportFit: "cover",
};
