import "server-only";

import type { User } from "@supabase/supabase-js";
import { getServerEnv } from "@/config/env";
import { MOCK_MANAGER_SESSION } from "@/domain/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevOrTestEnvironment, isEmailInAllowedManagerList } from "./access";

/**
 * Checks all security preconditions and auto-provisions a business membership for
 * allow-listed managers during local development or test environments.
 *
 * Preconditions:
 * 1. Environment must strictly be development or test (never production or staging).
 * 2. User's email must be present and included in ALLOWED_MANAGER_EMAILS.
 * 3. User's email must be verified (email_confirmed_at present).
 * 4. Sign-in provider must be Google (app_metadata.provider === 'google' or providers includes 'google').
 *
 * Resolves the business row by slug from DEV_BUSINESS_SLUG (defaults to MOCK_MANAGER_SESSION.business.slug).
 * Upserts the membership via the admin client: 'owner' for the first member of the business (or an
 * existing owner), 'manager' otherwise.
 * Returns true if auto-provisioned or already existing; false on any failure (safe, no throw, no sensitive logs).
 */
export async function maybeAutoProvisionDevManager(user: User): Promise<boolean> {
  try {
    // 1. Environment check
    if (!isDevOrTestEnvironment()) {
      return false;
    }

    // 2. Email in allowlist check
    if (!user.email || !isEmailInAllowedManagerList(user.email)) {
      return false;
    }

    // 3. Email confirmed check
    if (!user.email_confirmed_at) {
      return false;
    }

    // 4. Provider is Google check
    const appMetadata = user.app_metadata;
    const provider = appMetadata?.provider;
    const providers = appMetadata?.providers;
    const isGoogle =
      provider === "google" || (Array.isArray(providers) && providers.includes("google"));

    if (!isGoogle) {
      return false;
    }

    // Preconditions met. Resolve target business.
    const env = getServerEnv();
    const businessSlug = env.DEV_BUSINESS_SLUG || MOCK_MANAGER_SESSION.business.slug;

    const admin = createAdminClient();

    // Query business row by slug
    const { data: business, error: businessError } = await admin
      .from("businesses")
      .select("id")
      .eq("slug", businessSlug)
      .maybeSingle();

    if (businessError || !business?.id) {
      return false;
    }

    // The first member of a business must be an owner or nobody could ever change its payment
    // settings. Keep an existing owner as owner; otherwise only become owner when none exists.
    const { data: owners, error: ownersError } = await admin
      .from("business_members")
      .select("user_id")
      .eq("business_id", business.id)
      .eq("role", "owner");
    if (ownersError) {
      return false;
    }
    const hasOwner = (owners ?? []).length > 0;
    const isOwner = (owners ?? []).some((o) => o.user_id === user.id);
    const role = !hasOwner || isOwner ? "owner" : "manager";

    // Upsert business_members row
    const { error: upsertError } = await admin.from("business_members").upsert(
      {
        business_id: business.id,
        user_id: user.id,
        role,
      },
      {
        onConflict: "business_id,user_id",
      },
    );

    if (upsertError) {
      return false;
    }

    return true;
  } catch {
    // Fail closed with no leaked details and no sensitive logging
    return false;
  }
}
