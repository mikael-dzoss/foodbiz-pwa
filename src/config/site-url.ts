import type { VercelEnv } from "./env";

const LOCAL_FALLBACK_ORIGIN = "http://localhost:3000";

/** Absolute site origin for `metadataBase` (canonical/alternate links); undefined when unset or invalid. */
export function getSiteUrl(raw: string | undefined = process.env.NEXT_PUBLIC_SITE_URL) {
  if (!raw?.trim()) return undefined;
  try {
    return new URL(raw.trim());
  } catch {
    return undefined;
  }
}

export interface ResolveAuthBaseUrlInput {
  siteUrl?: string;
  nodeEnv?: string;
  vercelEnv?: VercelEnv;
  vercelUrl?: string;
  vercelBranchUrl?: string;
  requestOrigin?: string | null;
}

function toHttpsOrigin(host: string | undefined): string | null {
  const trimmed = host?.trim();
  if (
    !trimmed ||
    trimmed.includes("://") ||
    trimmed.includes("/") ||
    trimmed.includes("?") ||
    trimmed.includes("#")
  ) {
    return null;
  }
  try {
    const url = new URL(`https://${trimmed}`);
    return url.host === trimmed.toLowerCase() ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the trusted base origin for OAuth `redirectTo` without trusting forwarded headers:
 *   (a) `NEXT_PUBLIC_SITE_URL` when set;
 *   (b) on Vercel previews (`VERCEL_ENV === "preview"`): `requestOrigin` only if it exactly equals
 *       `https://${VERCEL_URL}` or `https://${VERCEL_BRANCH_URL}`, else `https://${VERCEL_BRANCH_URL}`,
 *       else `https://${VERCEL_URL}` (never taken for `VERCEL_ENV === "production"`);
 *   (c) non-production (`NODE_ENV !== "production"` and `VERCEL_ENV !== "production"`):
 *       `requestOrigin`, else `http://localhost:3000`;
 *   (d) otherwise `null` (fail closed → `auth_failed`).
 */
export function resolveAuthBaseUrl({
  siteUrl,
  nodeEnv,
  vercelEnv,
  vercelUrl,
  vercelBranchUrl,
  requestOrigin,
}: ResolveAuthBaseUrlInput): string | null {
  const configured = siteUrl?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (vercelEnv === "preview") {
    const deploymentOrigin = toHttpsOrigin(vercelUrl);
    const branchOrigin = toHttpsOrigin(vercelBranchUrl);

    if (
      requestOrigin &&
      ((deploymentOrigin !== null && requestOrigin === deploymentOrigin) ||
        (branchOrigin !== null && requestOrigin === branchOrigin))
    ) {
      return requestOrigin;
    }

    return branchOrigin ?? deploymentOrigin;
  }

  if (nodeEnv !== "production" && vercelEnv !== "production") {
    const origin = requestOrigin?.trim();
    return origin ? origin.replace(/\/+$/, "") : LOCAL_FALLBACK_ORIGIN;
  }

  return null;
}
