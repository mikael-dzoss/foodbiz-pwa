export const MAX_QUANTITY_PER_LINE = 50;
export const MAX_QUANTITY_PER_ORDER = 100;

export const RATE_LIMIT_IP_MAX_REQUESTS = 5;
export const RATE_LIMIT_PHONE_MAX_REQUESTS = 3;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

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

/**
 * FNV-1a 32-bit hash producing an 8-character hex string.
 * Used to anonymize identifiers (IPs, phone numbers) before logging, preventing PII leakage.
 */
export function hashIdentifier(val: string): string {
  let hash = 2166136261;
  for (let i = 0; i < val.length; i++) {
    hash ^= val.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export interface AntiAbuseRejectionEvent {
  readonly reason:
    "honeypot" | "rate_limit_ip" | "rate_limit_phone" | "max_line_quantity" | "max_order_quantity";
  readonly ip?: string | null;
  readonly phone?: string | null;
  readonly details?: Record<string, unknown>;
}

/**
 * Structured anti-abuse logger ensuring zero personal data (PII) is logged.
 * IP addresses and phone numbers are strictly hashed.
 */
export function logAntiAbuseRejection(event: AntiAbuseRejectionEvent): void {
  const ipHash = event.ip ? hashIdentifier(event.ip) : undefined;
  const phoneHash = event.phone ? hashIdentifier(event.phone) : undefined;

  console.warn("[anti-abuse] rejection", {
    reason: event.reason,
    ipHash,
    phoneHash,
    details: event.details,
    timestamp: new Date().toISOString(),
  });
}
