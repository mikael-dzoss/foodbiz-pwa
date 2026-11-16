import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/config/env";
import { isDevOrTestEnvironment } from "@/lib/auth/access";
import type { Database } from "./database.types";

/**
 * Creates an administrative Supabase client using the service-role key.
 * Strictly restricted to development and test environments for local manager auto-provisioning.
 * Throws immediately if invoked in production, staging, or preview environments.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const serverEnv = getServerEnv();
  const isDevOrTest = isDevOrTestEnvironment({
    nodeEnv: serverEnv.NODE_ENV,
    appEnv: serverEnv.APP_ENV,
  });

  if (!isDevOrTest) {
    throw new Error(
      "Admin Supabase client cannot be created outside development or test environments",
    );
  }

  const serviceRoleKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to create admin Supabase client");
  }

  const publicEnv = getPublicEnv();

  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
