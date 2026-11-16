import "server-only";

import { getServerEnv } from "@/config/env";
import type { Repositories } from "@/domain/repositories";
import { createPublicServerClient } from "@/lib/supabase/server";
import { getMockRepositories } from "./mock";
import { DEMO_BUSINESS_ID } from "./mock/fixtures/business";
import { createSupabaseRepositories } from "./supabase";

/**
 * Repositories for every code path an anonymous visitor can reach (catalog, product, cart,
 * checkout, order placement, confirmation, tracking, lookup).
 *
 * In Supabase mode the client carries no session and every read is restricted to public
 * columns (`publicOnly`), so new storefront code cannot accidentally select private settings
 * or read private tables. It is also safe inside `"use cache"` (no cookies are read).
 */
export function getStorefrontRepositories(): Repositories {
  if (getServerEnv().DATA_SOURCE === "supabase") {
    return createSupabaseRepositories(createPublicServerClient, { publicOnly: true });
  }
  return getMockRepositories();
}

/** The business the storefront serves: `STOREFRONT_BUSINESS_ID`, or the demo business in mock mode. */
export function getStorefrontBusinessId(): string {
  const env = getServerEnv();
  return env.STOREFRONT_BUSINESS_ID ?? DEMO_BUSINESS_ID;
}
