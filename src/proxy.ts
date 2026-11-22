import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { MOCK_AUTH_COOKIE_NAME } from "@/domain/auth";
import { getServerEnv } from "@/config/env";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/domain/i18n";

/** First path segments that are not storefront locales. */
const TOP_LEVEL_AREAS = new Set(["manage", "auth", "patterns", "api"]);

/**
 * `[locale]` is a top-level dynamic segment, so `/zzz` or `/de/cart` would match it and 404 from
 * its root layout, where Next can only show its bare default page. Rewriting them under the
 * default locale to a path no route matches gives the localized storefront not-found, in the
 * storefront shell, with a real 404 status.
 */
export function unknownLocaleRewrite(pathname: string): string | null {
  const first = pathname.split("/")[1];
  if (!first || isSupportedLocale(first) || TOP_LEVEL_AREAS.has(first)) return null;
  return `/${DEFAULT_LOCALE}/__unknown${pathname}`;
}

export async function proxy(request: NextRequest) {
  const env = getServerEnv();
  const { pathname } = request.nextUrl;

  const rewrite = unknownLocaleRewrite(pathname);
  if (rewrite) return NextResponse.rewrite(new URL(rewrite, request.url));

  // Mock data source: convenience redirect for unauthenticated /manage routes
  if (env.DATA_SOURCE === "mock") {
    if (pathname.startsWith("/manage") && !pathname.startsWith("/manage/login")) {
      const mockCookie = request.cookies.get(MOCK_AUTH_COOKIE_NAME)?.value;
      if (mockCookie !== "active") {
        const loginUrl = new URL("/manage/login", request.url);
        loginUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
    return NextResponse.next({ request });
  }

  // Supabase data source: refresh session and redirect unauthenticated /manage requests
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, image optimisation, PWA files and images.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
