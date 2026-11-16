/**
 * Order limits. The database enforces the SAME numbers inside `place_order` (see
 * supabase/migrations/20260101000012_place_order_hardening.sql, `c_*` constants) because
 * anonymous callers can reach the RPC directly. Change both together: the live contract
 * test (order.contract.ts) exercises the database at these exact boundaries and fails if
 * they diverge.
 */
export const MAX_QUANTITY_PER_LINE = 50;
export const MAX_QUANTITY_PER_ORDER = 100;
export const MAX_LINES_PER_ORDER = 50;

/** Per-IP is an app-level first layer only (the database cannot trust client IP headers). */
export const RATE_LIMIT_IP_MAX_REQUESTS = 5;
/** Enforced in the database (`rate_limit_attempts`, hashed phone) and mirrored by the mock repository. */
export const RATE_LIMIT_PHONE_MAX_REQUESTS = 3;
/** Per-business flood brake enforced in the database and mirrored by the mock repository. */
export const RATE_LIMIT_BUSINESS_MAX_ORDERS = 120;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Order lookup (#230): enough for a few typos, low enough to block enumeration.
export const LOOKUP_RATE_LIMIT_IP_MAX_REQUESTS = 10;
/** Failed lookups per phone: enforced in the database (`storefront_order_tracking_token`). */
export const LOOKUP_RATE_LIMIT_PHONE_MAX_REQUESTS = 5;

export type HoneypotValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: "HONEYPOT_TRIGGERED" };

/**
 * Validates the honeypot field. Real users leave this hidden field blank.
 * If populated by a bot, the request must be rejected.
 */
export function validateHoneypot(honeypotValue?: string | null): HoneypotValidationResult {
  if (honeypotValue && honeypotValue.trim().length > 0) {
    return { ok: false, reason: "HONEYPOT_TRIGGERED" };
  }
  return { ok: true };
}

export type OrderQuantitiesValidationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: "MAX_LINE_QUANTITY_EXCEEDED" | "MAX_ORDER_QUANTITY_EXCEEDED";
      readonly message: string;
      readonly productId?: string;
    };

/**
 * Enforces per-line (<= 50) and per-order (<= 100) maximum quantities to protect stock and operations from automated spam.
 */
export function validateOrderQuantities(
  items: ReadonlyArray<{ readonly productId: string; readonly quantity: number }>,
): OrderQuantitiesValidationResult {
  let totalQuantity = 0;

  for (const item of items) {
    if (item.quantity > MAX_QUANTITY_PER_LINE) {
      return {
        ok: false,
        code: "MAX_LINE_QUANTITY_EXCEEDED",
        productId: item.productId,
        message: `Maximum quantity of ${MAX_QUANTITY_PER_LINE} exceeded for this item.`,
      };
    }
    totalQuantity += item.quantity;
  }

  if (totalQuantity > MAX_QUANTITY_PER_ORDER) {
    return {
      ok: false,
      code: "MAX_ORDER_QUANTITY_EXCEEDED",
      message: `Total order quantity exceeds the limit of ${MAX_QUANTITY_PER_ORDER} items.`,
    };
  }

  return { ok: true };
}
