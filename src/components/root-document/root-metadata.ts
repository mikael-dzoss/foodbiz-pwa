import type { Metadata, Viewport } from "next";
import { APP_METADATA } from "@/config/app";
import { getSiteUrl } from "@/config/site-url";

// No title template, applicationName, appleWebApp.title or manifest here: each area
// (`/[locale]` storefront, `/manage`) owns its own so neither inherits the other's identity.
export const rootMetadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: APP_METADATA.manager.name,
  description: APP_METADATA.manager.description,
  appleWebApp: { capable: true, statusBarStyle: "default" },
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
