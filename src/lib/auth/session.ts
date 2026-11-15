import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/config/env";
import { MOCK_AUTH_COOKIE_NAME, MOCK_MANAGER_SESSION, type ManagerSession } from "@/domain/auth";
import { createClient } from "@/lib/supabase/server";
import { maybeAutoProvisionDevManager } from "./dev-provisioning";

export { MOCK_AUTH_COOKIE_NAME };

/**
 * Retrieves the current manager session.
 * In mock mode (development only), returns the mock manager fixture.
 * In production, mock sessions are strictly forbidden and throw.
 */
export async function getManagerSession(): Promise<ManagerSession | null> {
  const env = getServerEnv();

  if (env.DATA_SOURCE === "mock") {
    const cookieStore = await cookies();
    const mockCookie = cookieStore.get(MOCK_AUTH_COOKIE_NAME)?.value;

    if (mockCookie !== "active") {
      return null;
    }

    return MOCK_MANAGER_SESSION;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Query 'business_members' table for verified role (owner/manager/staff) and associated business
  let { data: membership } = await supabase
    .from("business_members")
    .select("id, business_id, role, businesses(id, name, slug, currency)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  // If no business_members row exists, attempt dev/test auto-provisioning for allow-listed managers
  if (!membership) {
    const provisioned = await maybeAutoProvisionDevManager(user);
    if (provisioned) {
      // Re-run normal membership query through user's own (RLS) client so returned session comes from the real DB
      const rerun = await supabase
        .from("business_members")
        .select("id, business_id, role, businesses(id, name, slug, currency)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      membership = rerun.data;
    }
  }

  if (!membership) {
    return null;
  }

  type BusinessJoinRecord = {
    id: string;
    name: string;
    slug: string;
    currency: string;
  };

  const joinedBusinesses = membership.businesses as
    BusinessJoinRecord | BusinessJoinRecord[] | null;

  let businessRecord: BusinessJoinRecord | null = Array.isArray(joinedBusinesses)
    ? (joinedBusinesses[0] ?? null)
    : joinedBusinesses;

  if (!businessRecord && membership.business_id) {
    const { data: directBusiness } = await supabase
      .from("businesses")
      .select("id, name, slug, currency")
      .eq("id", membership.business_id)
      .maybeSingle();

    businessRecord = directBusiness as BusinessJoinRecord | null;
  }

  const business = {
    id: businessRecord?.id ?? membership.business_id,
    name: businessRecord?.name ?? "Business",
    slug: businessRecord?.slug ?? "business",
    currency: (businessRecord?.currency ?? "EUR") as "EUR",
  };

  const role = (membership.role as "owner" | "manager" | "staff") ?? "manager";

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      name:
        (user.user_metadata?.name as string) ??
        (user.user_metadata?.full_name as string) ??
        user.email ??
        "Manager",
      role,
      businessId: membership.business_id,
    },
    business,
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
