import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/config/env";
import {
  MOCK_AUTH_COOKIE_NAME,
  MOCK_MANAGER_SESSION,
  managerSessionSchema,
  type ManagerSession,
} from "@/domain/auth";
import { getRepositories } from "@/lib/repositories";
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

  if (!user || !user.email) {
    return null;
  }

  const repos = getRepositories("supabase", supabase);
  let membership = await repos.members.findMembershipForUser(user.id);

  // If no business_members row exists, attempt dev/test auto-provisioning for allow-listed managers
  if (!membership) {
    const provisioned = await maybeAutoProvisionDevManager(user);
    if (provisioned) {
      // Re-query membership through user's client so returned session comes from the real DB
      membership = await repos.members.findMembershipForUser(user.id);
    }
  }

  if (!membership) {
    return null;
  }

  // Derive expiresAt from verified JWT claims rather than fabricating a fake +24h
  const { data: claimsData } = await supabase.auth.getClaims();
  const expSeconds = typeof claimsData?.claims?.exp === "number" ? claimsData.claims.exp : null;
  const expiresAt = expSeconds ? new Date(expSeconds * 1000).toISOString() : null;

  const rawName =
    typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()
      ? user.user_metadata.name.trim()
      : typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()
        ? user.user_metadata.full_name.trim()
        : user.email.trim();

  return managerSessionSchema.parse({
    user: {
      id: user.id,
      email: user.email,
      name: rawName,
      role: membership.member.role,
      businessId: membership.member.businessId,
    },
    business: membership.business,
    expiresAt,
  });
}

/**
 * Enforces manager authentication on server components and server actions.
 * Redirects unauthenticated requests to /manage/login.
 * In Supabase mode, redirects signed-in users without business membership to /manage/login?error=no_access.
 */
export async function requireManagerSession(): Promise<ManagerSession> {
  const env = getServerEnv();
  const session = await getManagerSession();

  if (!session) {
    if (env.DATA_SOURCE === "supabase") {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        redirect("/manage/login?error=no_access");
      }
    }

    redirect("/manage/login");
  }

  return session;
}
