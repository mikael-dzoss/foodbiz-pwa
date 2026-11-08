import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { MOCK_AUTH_COOKIE_NAME } from "@/domain/auth";
import { getServerEnv } from "@/config/env";

export async function proxy(request: NextRequest) {
  const env = getServerEnv();
  const { pathname } = request.nextUrl;

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
