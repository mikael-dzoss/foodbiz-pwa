import type { MetadataRoute } from "next";
import { APP_METADATA } from "@/config/app";

/**
 * The manager dashboard is the installable app. `scope` stays `/` (not `/manage/`) so the
 * OAuth round trip through `/auth/callback` and links to the storefront remain in-app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: APP_METADATA.manifestId,
    name: APP_METADATA.name,
    short_name: APP_METADATA.shortName,
    description: APP_METADATA.description,
    start_url: APP_METADATA.startUrl,
    scope: APP_METADATA.scope,
    display: "standalone",
    orientation: "portrait",
    background_color: APP_METADATA.backgroundColor,
    theme_color: APP_METADATA.themeColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
