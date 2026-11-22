import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/config/env";
import type { Database } from "./database.types";

/** Refreshes the Supabase auth session cookie on every matched request. */
export async function updateSession(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between client creation and getClaims(): it revalidates the session.
  const { data } = await supabase.auth.getClaims();

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/manage") && !pathname.startsWith("/manage/login") && !data?.claims) {
    const loginUrl = new URL(`/manage/login?next=${encodeURIComponent(pathname)}`, request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}
