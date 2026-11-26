import { lstatSync, realpathSync } from "node:fs";
import { dirname } from "node:path";
import type { NextConfig } from "next";
import { DEFAULT_LOCALE } from "./src/domain/i18n/types";
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

/**
 * Agent worktrees (.claude/worktrees/*) symlink the main checkout's node_modules. Turbopack won't
 * resolve outside its root (by default the worktree), so widen the root to the main checkout,
 * which holds both. Unset elsewhere (main checkout, CI).
 */
function linkedCheckoutRoot(): string | undefined {
  try {
    if (!lstatSync("node_modules").isSymbolicLink()) return undefined;
    return dirname(realpathSync("node_modules"));
  } catch {
    return undefined;
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  outputFileTracingIncludes: {
    "/\\[locale\\]/opengraph-image": ["./public/images/**"],
    "/\\[locale\\]/p/\\[id\\]/opengraph-image": ["./public/images/**"],
  },
  headers() {
    return [
      {
        source: "/:path*",
        // Raw process.env on purpose: next.config loads before the app, so src/config/env.ts
        // (zod) isn't available here; requireSupabase makes production builds fail closed instead.
        headers: buildSecurityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          isDev: process.env.NODE_ENV === "development",
          requireSupabase: process.env.NODE_ENV === "production",
          // Local/test stacks run production builds over plain http.
          secureTransport:
            process.env.NODE_ENV === "production" && appEnv !== "development" && appEnv !== "test",
        }),
      },
    ];
  },
  partialPrefetching: true,
  // No root layout above `/`, so the redirect to the default storefront locale lives here.
  redirects() {
    return [{ source: "/", destination: `/${DEFAULT_LOCALE}`, permanent: false }];
  },
  experimental: { globalNotFound: true },
  images: {
    remotePatterns: supabaseImagePattern(),
    // Next blocks loopback hosts by default; needed only for the local Supabase stack in dev.
    dangerouslyAllowLocalIP: isLocalSupabase && process.env.NODE_ENV !== "production",
  },
  turbopack: {
    root: linkedCheckoutRoot(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
