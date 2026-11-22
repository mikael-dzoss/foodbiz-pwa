import { createHmac, randomBytes } from "node:crypto";

// Random per-process salt: hashes cannot be brute-forced back to IPs/phone numbers,
// and are only correlatable within one server process lifetime.
const PROCESS_SALT = randomBytes(32);

/**
 * Salted HMAC-SHA256 (truncated to 16 hex chars) used to anonymize identifiers
 * (IPs, phone numbers) before logging.
 */
export function hashIdentifier(val: string): string {
  return createHmac("sha256", PROCESS_SALT).update(val).digest("hex").slice(0, 16);
}

export interface AntiAbuseRejectionEvent {
  readonly reason:
    | "honeypot"
    | "rate_limit_ip"
    | "rate_limit_phone"
    | "max_line_quantity"
    | "max_order_quantity"
    | "lookup_rate_limit_ip"
    | "lookup_rate_limit_phone";
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
