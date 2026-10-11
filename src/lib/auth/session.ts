import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/config/env";
import { MOCK_MANAGER_SESSION, type ManagerSession } from "@/domain/auth";
import { createClient } from "@/lib/supabase/server";

export const MOCK_AUTH_COOKIE_NAME = "foodbiz_mock_session";

/**
 * Retrieves the current manager session.
 * In mock mode (development only), returns the mock manager fixture.
 * In production, mock sessions are strictly forbidden and throw.
 */
export async function getManagerSession(): Promise<ManagerSession | null> {
  if (process.env.NODE_ENV === "production" && process.env.DATA_SOURCE === "mock") {
    throw new Error("Mock manager session cannot be enabled in production");
  }

  const env = getServerEnv();

  if (env.DATA_SOURCE === "mock") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Mock manager session cannot be enabled in production");
    }

    const cookieStore = await cookies();
    const mockCookie = cookieStore.get(MOCK_AUTH_COOKIE_NAME)?.value;

    if (mockCookie === "signed-out") {
      return null;
    }

    return MOCK_MANAGER_SESSION;
  }

  // Supabase auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const businessId = (user.user_metadata?.business_id as string) ?? "";
  const role = (user.user_metadata?.role as "owner" | "manager" | "staff") ?? "manager";
  const businessName = (user.user_metadata?.business_name as string) ?? "Business";
  const businessSlug = (user.user_metadata?.business_slug as string) ?? "business";

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      name: (user.user_metadata?.name as string) ?? user.email ?? "Manager",
      role,
      businessId,
    },
    business: {
      id: businessId,
      name: businessName,
      slug: businessSlug,
      currency: "EUR",
    },
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
}

/**
 * Enforces manager authentication on server components and server actions.
 * Redirects unauthenticated requests to /manage/login.
 */
export async function requireManagerSession(): Promise<ManagerSession> {
  const session = await getManagerSession();

  if (!session) {
    redirect("/manage/login");
  }

  return session;
}
