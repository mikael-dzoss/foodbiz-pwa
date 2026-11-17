import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/config/security-headers";

/**
 * Allow `next/image` to optimise product images served from this project's public
 * `product-images` Storage bucket (and nothing else on the host).
 */
function supabaseImagePattern(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const url = new URL(raw);
    return [
      {
        protocol: url.protocol === "http:" ? "http" : "https",
        hostname: url.hostname,
        port: url.port,
        pathname: "/storage/v1/object/public/product-images/**",
        search: "",
      },
    ];
  } catch {
    return [];
  }
}

const isLocalSupabase = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
);

const appEnv = process.env.APP_ENV;

const nextConfig: NextConfig = {
  cacheComponents: true,
  headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          isDev: process.env.NODE_ENV === "development",
          // Local/test stacks run production builds over plain http.
          secureTransport:
            process.env.NODE_ENV === "production" && appEnv !== "development" && appEnv !== "test",
        }),
      },
    ];
  },
  partialPrefetching: true,
  images: {
    remotePatterns: supabaseImagePattern(),
    // Next blocks loopback hosts by default; needed only for the local Supabase stack in dev.
    dangerouslyAllowLocalIP: isLocalSupabase && process.env.NODE_ENV !== "production",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
