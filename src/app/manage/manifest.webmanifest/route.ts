import type { MetadataRoute } from "next";
import { APP_METADATA } from "@/config/app";

/**
 * Web app manifest for the manager dashboard (`/manage`).
 *
 * Keeps `id: "/manage"` unchanged so existing manager installs update in place, while
 * `scope: "/manage"` isolates manager installs from the customer storefront. OAuth
 * `/auth/callback` only redirects and ends on `/manage`, so being outside scope is fine.
 */
export function GET(): Response {
  const manifest: MetadataRoute.Manifest = {
    id: APP_METADATA.manager.manifestId,
    name: APP_METADATA.manager.name,
    short_name: APP_METADATA.manager.shortName,
    description: APP_METADATA.manager.description,
    start_url: APP_METADATA.manager.startUrl,
    scope: APP_METADATA.manager.scope,
    display: APP_METADATA.display,
    orientation: APP_METADATA.orientation,
    background_color: APP_METADATA.backgroundColor,
    theme_color: APP_METADATA.themeColor,
    icons: APP_METADATA.icons.map((icon) => ({ ...icon })),
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
