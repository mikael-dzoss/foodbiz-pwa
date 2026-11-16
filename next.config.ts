import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  cacheComponents: true,
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
