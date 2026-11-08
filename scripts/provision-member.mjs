import process from "node:process";
import { createClient } from "@supabase/supabase-js";

export const ALLOWED_ROLES = ["owner", "manager", "staff"];

/**
 * @typedef {"owner" | "manager" | "staff"} ProvisionRole
 * @typedef {{
 *   businessSlug?: string;
 *   businessId?: string;
 *   email?: string;
 *   userId?: string;
 *   role?: ProvisionRole;
 * }} ProvisionOptions
 */

/**
 * Validates required environment variables for administrative provisioning.
 * SUPABASE_SERVICE_ROLE_KEY is strictly server-only and must never be exposed to clients.
 * @param {Record<string, string | undefined>} [env=process.env]
 */
export function checkProvisionEnv(env = process.env) {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. This server-only secret is required to provision business members.",
    );
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL environment variable.");
  }

  return { supabaseUrl, serviceRoleKey };
}

/**
 * Parses CLI arguments for provisioning a business member.
 * Supports:
 *   --business-slug <slug> | --business-slug=<slug>
 *   --business-id <uuid>   | --business-id=<uuid>
 *   --email <email>        | --email=<email>
 *   --user-id <uuid>       | --user-id=<uuid>
 *   --role <role>          | --role=<role> (default: manager)
 */
export function parseProvisionArgs(argv = []) {
  const options = {
    role: "manager",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--business-slug") {
      options.businessSlug = argv[++i];
    } else if (arg.startsWith("--business-slug=")) {
      options.businessSlug = arg.slice("--business-slug=".length);
    } else if (arg === "--business-id") {
      options.businessId = argv[++i];
    } else if (arg.startsWith("--business-id=")) {
      options.businessId = arg.slice("--business-id=".length);
    } else if (arg === "--email") {
      options.email = argv[++i];
    } else if (arg.startsWith("--email=")) {
      options.email = arg.slice("--email=".length);
    } else if (arg === "--user-id") {
      options.userId = argv[++i];
    } else if (arg.startsWith("--user-id=")) {
      options.userId = arg.slice("--user-id=".length);
    } else if (arg === "--role") {
      options.role = argv[++i];
    } else if (arg.startsWith("--role=")) {
      options.role = arg.slice("--role=".length);
    }
  }

  if (options.role && !ALLOWED_ROLES.includes(options.role)) {
    throw new Error(`Invalid role "${options.role}". Allowed roles: ${ALLOWED_ROLES.join(", ")}`);
  }

  if (!options.businessSlug && !options.businessId) {
    throw new Error("Either --business-slug or --business-id is required");
  }

  if (!options.email && !options.userId) {
    throw new Error("Either --email or --user-id is required");
  }

  return options;
}

/**
 * Provisions a member into public.business_members with the specified role.
 * Resolves business by slug or id, and resolves user by email or user id.
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {ProvisionOptions} [options={}]
 */
export async function provisionBusinessMember(client, options = {}) {
  if (!client) {
    throw new Error("Supabase client is required");
  }

  const role = options.role ?? "manager";
  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error(`Invalid role "${role}". Allowed roles: ${ALLOWED_ROLES.join(", ")}`);
  }

  // 1. Resolve business
  let business = null;
  if (options.businessId) {
    const { data, error } = await client
      .from("businesses")
      .select("id, name, slug, currency")
      .eq("id", options.businessId)
      .maybeSingle();

    if (error || !data) {
      throw new Error(`Business not found with ID "${options.businessId}"`);
    }
    business = data;
  } else if (options.businessSlug) {
    const { data, error } = await client
      .from("businesses")
      .select("id, name, slug, currency")
      .eq("slug", options.businessSlug)
      .maybeSingle();

    if (error || !data) {
      throw new Error(`Business not found with slug "${options.businessSlug}"`);
    }
    business = data;
  } else {
    throw new Error("Either --business-slug or --business-id must be specified");
  }

  // 2. Resolve user ID
  let userId = options.userId;
  if (!userId) {
    if (!options.email) {
      throw new Error("Either --email or --user-id must be specified");
    }

    const normalizedEmail = options.email.trim().toLowerCase();
    const { data: usersData, error: listError } = await client.auth.admin.listUsers();
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const users = usersData?.users ?? [];
    const foundUser = users.find((u) => u.email?.trim().toLowerCase() === normalizedEmail);

    if (!foundUser) {
      throw new Error(`User not found with email "${options.email}"`);
    }
    userId = foundUser.id;
  }

  // 3. Upsert into public.business_members
  const { data: member, error: upsertError } = await client
    .from("business_members")
    .upsert(
      {
        business_id: business.id,
        user_id: userId,
        role,
      },
      { onConflict: "business_id,user_id" },
    )
    .select()
    .single();

  if (upsertError) {
    throw new Error(`Failed to provision business member: ${upsertError.message}`);
  }

  return {
    member,
    business,
    userId,
    role,
  };
}

/**
 * CLI main function.
 */
export async function main(argv = process.argv.slice(2)) {
  const { supabaseUrl, serviceRoleKey } = checkProvisionEnv();
  const options = parseProvisionArgs(argv);
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await provisionBusinessMember(client, options);
  console.log(
    `✓ Successfully provisioned member: user ${result.userId} as ${result.role} for business "${result.business.name}" (${result.business.slug}).`,
  );
  return result;
}

if (process.argv[1]?.endsWith("provision-member.mjs")) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
