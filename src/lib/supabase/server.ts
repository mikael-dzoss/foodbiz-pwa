import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/config/env";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Create a new client per request — never share it across requests.
 */
export async function createClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: cookies are read-only there.
            // Session refresh is handled by `src/proxy.ts`.
          }
        },
      },
    },
  );
}

/**
 * Unauthenticated Supabase client for cached / public Server Components and static generation.
 * Does not read cookies() from next/headers and can safely be used inside "use cache".
 */
export function createPublicServerClient() {
  const env = getPublicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    },
  );
}
