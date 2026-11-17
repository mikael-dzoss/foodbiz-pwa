import process from "node:process";
import { createClient } from "@supabase/supabase-js";

export const ALLOWED_ROLES = ["owner", "manager", "staff"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether the given hostname represents a local development host.
 * @param {string} [hostname=""]
 * @returns {boolean}
 */
export function isLocalHost(hostname = "") {
  const h = (hostname || "").toLowerCase().trim();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "host.docker.internal" ||
    h.endsWith(".localhost")
  );
}

/**
 * @typedef {"owner" | "manager" | "staff"} ProvisionRole
 * @typedef {{
 *   businessSlug?: string;
 *   businessId?: string;
 *   email?: string;
 *   userId?: string;
 *   role?: ProvisionRole;
 *   yes?: boolean;
 *   force?: boolean;
 *   targetHost?: string;
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
 * Parses and validates CLI arguments for provisioning a business member.
 * Supports:
 *   --business-slug <slug> | --business-slug=<slug>
 *   --business-id <uuid>   | --business-id=<uuid>
 *   --email <email>        | --email=<email>
 *   --user-id <uuid>       | --user-id=<uuid>
 *   --role <role>          | --role=<role> (default: owner for the first member of a business, else manager)
 *   --yes                  | --yes=true
 *   --force                | --force=true
 * @param {string[]} [argv=[]]
 * @returns {ProvisionOptions}
 */
export function parseProvisionArgs(argv = []) {
  const options = {
    // Left unset on purpose: the first member of a business becomes its owner (see
    // provisionBusinessMember), later ones managers.
    role: undefined,
    yes: false,
    force: false,
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
    } else if (arg === "--yes" || arg === "--yes=true") {
      options.yes = true;
    } else if (arg === "--force" || arg === "--force=true") {
      options.force = true;
    }
  }

  // L7: Validation of role
  if (options.role !== undefined && !ALLOWED_ROLES.includes(options.role)) {
    throw new Error(`Invalid role "${options.role}". Allowed roles: ${ALLOWED_ROLES.join(", ")}`);
  }

  // L7: Exactly one of business-slug or business-id
  const hasSlug = Boolean(options.businessSlug);
  const hasBizId = Boolean(options.businessId);
  if ((hasSlug && hasBizId) || (!hasSlug && !hasBizId)) {
    throw new Error("Exactly one of --business-slug or --business-id must be specified");
  }

  // L7: Exactly one of email or user-id
  const hasEmail = Boolean(options.email);
  const hasUserId = Boolean(options.userId);
  if ((hasEmail && hasUserId) || (!hasEmail && !hasUserId)) {
    throw new Error("Exactly one of --email or --user-id must be specified");
  }

  // L7: Email syntax validation
  if (options.email && !EMAIL_REGEX.test(options.email.trim())) {
    throw new Error(`Invalid email address format: "${options.email}"`);
  }

  // L7: UUID format validation for businessId and userId
  if (options.businessId && !UUID_REGEX.test(options.businessId.trim())) {
    throw new Error(`Invalid UUID format for --business-id: "${options.businessId}"`);
  }
  if (options.userId && !UUID_REGEX.test(options.userId.trim())) {
    throw new Error(`Invalid UUID format for --user-id: "${options.userId}"`);
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

  if (options.role !== undefined && !ALLOWED_ROLES.includes(options.role)) {
    throw new Error(`Invalid role "${options.role}". Allowed roles: ${ALLOWED_ROLES.join(", ")}`);
  }

  // H8: Production safety guard for non-local host targets
  const targetHost = options.targetHost ?? "localhost";
  if (!isLocalHost(targetHost) && !options.yes) {
    throw new Error(
      `Refusing to write to non-local target host "${targetHost}" without explicit confirmation. Pass --yes to confirm provisioning on remote/production environments.`,
    );
  }

  // 1. Resolve business with distinct error handling (H7)
  let business = null;
  if (options.businessId) {
    const { data, error } = await client
      .from("businesses")
      .select("id, name, slug, currency")
      .eq("id", options.businessId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query business: ${error.message}`);
    }
    if (!data) {
      throw new Error(`Business not found with ID "${options.businessId}"`);
    }
    business = data;
  } else if (options.businessSlug) {
    const { data, error } = await client
      .from("businesses")
      .select("id, name, slug, currency")
      .eq("slug", options.businessSlug)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query business: ${error.message}`);
    }
    if (!data) {
      throw new Error(`Business not found with slug "${options.businessSlug}"`);
    }
    business = data;
  } else {
    throw new Error("Exactly one of --business-slug or --business-id must be specified");
  }

  // 2. Resolve user ID (H7: paginated listUsers or direct getUserById)
  let userId = options.userId;
  let userIdentifier = options.userId;

  if (userId) {
    const { data: userData, error: userError } = await client.auth.admin.getUserById(userId);
    if (userError) {
      throw new Error(`Failed to query user: ${userError.message}`);
    }
    if (!userData?.user) {
      throw new Error(`User not found with ID "${userId}"`);
    }
    userId = userData.user.id;
    userIdentifier = userData.user.email ?? userId;
  } else if (options.email) {
    const normalizedEmail = options.email.trim().toLowerCase();
    userIdentifier = normalizedEmail;

    let page = 1;
    const perPage = 200;
    const MAX_PAGES = 50;
    let foundUser = null;

    while (page <= MAX_PAGES) {
      const { data: usersData, error: listError } = await client.auth.admin.listUsers({
        page,
        perPage,
      });

      if (listError) {
        throw new Error(`Failed to list users: ${listError.message}`);
      }

      const users = usersData?.users ?? [];
      foundUser = users.find((u) => u.email?.trim().toLowerCase() === normalizedEmail);

      if (foundUser) {
        break;
      }

      if (users.length < perPage) {
        break;
      }

      page++;
    }

    if (!foundUser) {
      throw new Error(`User not found with email "${options.email}"`);
    }
    userId = foundUser.id;
  } else {
    throw new Error("Exactly one of --email or --user-id must be specified");
  }

  // Default role: the first member of a business is its owner (nobody is locked out of the
  // owner-only settings); later members are managers. An explicit --role always wins.
  let role = options.role;
  if (role === undefined) {
    const { data: owners, error: ownersError } = await client
      .from("business_members")
      .select("user_id")
      .eq("business_id", business.id)
      .eq("role", "owner");
    if (ownersError) {
      throw new Error(`Failed to query business owners: ${ownersError.message}`);
    }
    const hasOwner = (owners ?? []).length > 0;
    const isOwner = (owners ?? []).some((o) => o.user_id === userId);
    role = !hasOwner || isOwner ? "owner" : "manager";
  }

  // H8: Check existing membership role change guard
  const { data: existingMember, error: queryMemberError } = await client
    .from("business_members")
    .select("id, role")
    .eq("business_id", business.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (queryMemberError) {
    throw new Error(`Failed to query existing membership: ${queryMemberError.message}`);
  }

  if (existingMember && existingMember.role !== role && !options.force) {
    throw new Error(
      `User is already a member of business "${business.slug}" with role "${existingMember.role}". Refusing to change role to "${role}" without --force flag.`,
    );
  }

  // H8: Print clear summary line before writing (never print service-role key!)
  console.log(
    `Provisioning member: host=${targetHost}, business=${business.slug} (${business.id}), user=${userIdentifier} (${userId}), role=${role}`,
  );

  // 3. Upsert into public.business_members idempotently. A business has exactly one owner (unique
  // index): if a concurrent run took the owner slot (23505), an implicit role falls back to
  // manager; an explicit --role owner fails with a clear message.
  const upsertMember = (memberRole) =>
    client
      .from("business_members")
      .upsert(
        { business_id: business.id, user_id: userId, role: memberRole },
        { onConflict: "business_id,user_id" },
      )
      .select()
      .single();

  let { data: member, error: upsertError } = await upsertMember(role);
  if (upsertError?.code === "23505" && role === "owner") {
    if (options.role !== undefined) {
      throw new Error(
        `Business "${business.slug}" already has an owner; cannot provision a second one.`,
      );
    }
    role = "manager";
    ({ data: member, error: upsertError } = await upsertMember(role));
  }

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
 * @param {string[]} [argv=process.argv.slice(2)]
 */
export async function main(argv = process.argv.slice(2)) {
  const { supabaseUrl, serviceRoleKey } = checkProvisionEnv();
  const options = parseProvisionArgs(argv);

  let targetHost = "localhost";
  try {
    targetHost = new URL(supabaseUrl).hostname;
  } catch {
    targetHost = supabaseUrl;
  }
  options.targetHost = targetHost;

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
