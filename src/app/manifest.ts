import type { MetadataRoute } from "next";
import { APP_METADATA } from "@/config/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_METADATA.name,
    short_name: APP_METADATA.shortName,
    description: APP_METADATA.description,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: APP_METADATA.backgroundColor,
    theme_color: APP_METADATA.themeColor,
    icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
