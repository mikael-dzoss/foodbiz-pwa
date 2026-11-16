import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";
import { businessMemberRoleSchema } from "./business";

export const MOCK_AUTH_COOKIE_NAME = "foodbiz_mock_session";

export const authErrorCodeSchema = z.enum(["cancelled", "denied", "no_access", "auth_failed"]);

export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>;

/**
 * Normalizes OAuth error and description into a known AuthErrorCode or null.
 */
export function normalizeAuthErrorCode(
  error?: string | null,
  errorDescription?: string | null,
): AuthErrorCode | null {
  const err = error?.trim().toLowerCase() ?? "";
  const desc = errorDescription?.trim().toLowerCase() ?? "";

  if (!err && !desc) {
    return null;
  }

  if (
    err === "cancelled" ||
    err === "user_cancelled" ||
    desc === "cancelled" ||
    desc === "user_cancelled" ||
    (err === "access_denied" && desc.includes("cancel")) ||
    desc.includes("cancel")
  ) {
    return "cancelled";
  }

  if (err === "denied" || err === "access_denied") {
    return "denied";
  }

  if (err === "no_access" || err === "forbidden" || err === "unauthorized") {
    return "no_access";
  }

  return "auth_failed";
}

/**
 * Sanitizes manager redirect path preventing open redirects and login loops.
 */
export function sanitizeManagerRedirectPath(
  nextPath?: string | null,
  fallback = "/manage",
): string {
  if (!nextPath || typeof nextPath !== "string") {
    return fallback;
  }

  // Reject any control characters in input
  if (/[\x00-\x1F\x7F]/.test(nextPath)) {
    return fallback;
  }

  const trimmed = nextPath.trim();

  // Must strictly be /manage or start with /manage/
  if (trimmed !== "/manage" && !trimmed.startsWith("/manage/")) {
    return fallback;
  }

  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\\") ||
    trimmed.startsWith("/manage/login")
  ) {
    return fallback;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || trimmed.includes("://")) {
    return fallback;
  }

  // Reject traversal segments (both raw and URL-encoded)
  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return fallback;
  }

  if (
    decoded.includes("..") ||
    (decoded !== "/manage" && !decoded.startsWith("/manage/")) ||
    decoded.startsWith("/manage/login") ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded) ||
    decoded.includes("://") ||
    decoded.includes("\\")
  ) {
    return fallback;
  }

  return trimmed;
}

export const managerUserSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  name: z.string().trim().min(1),
  role: businessMemberRoleSchema,
  businessId: uuidSchema,
});

export type ManagerUser = z.infer<typeof managerUserSchema>;

export const managerBusinessSummarySchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  currency: z.literal("EUR").default("EUR"),
});

export type ManagerBusinessSummary = z.infer<typeof managerBusinessSummarySchema>;

export const managerSessionSchema = z.object({
  user: managerUserSchema,
  business: managerBusinessSummarySchema,
  expiresAt: isoDateTimeSchema.nullable(),
});

export type ManagerSession = z.infer<typeof managerSessionSchema>;

export const MOCK_MANAGER_SESSION: ManagerSession = {
  user: {
    id: "00000000-0000-4000-8000-000000000002",
    email: "manager@lapetiteboulangerie.fr",
    name: "Marie Dupont",
    role: "manager",
    businessId: "11111111-1111-4111-8111-111111111111",
  },
  business: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "La Petite Boulangerie",
    slug: "la-petite-boulangerie",
    currency: "EUR",
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
};
