import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MAX_QUANTITY_PER_LINE,
  MAX_QUANTITY_PER_ORDER,
  RATE_LIMIT_IP_MAX_REQUESTS,
  RATE_LIMIT_PHONE_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  validateHoneypot,
  validateOrderQuantities,
  hashIdentifier,
  logAntiAbuseRejection,
  type AntiAbuseRejectionEvent,
} from "../anti-abuse";
import { RateLimiter } from "@/lib/rate-limiter";

describe("Anti-Abuse Domain Logic", () => {
  describe("validateHoneypot", () => {
    it("accepts empty, undefined, or whitespace-only honeypot values", () => {
      expect(validateHoneypot(undefined)).toEqual({ ok: true });
      expect(validateHoneypot(null)).toEqual({ ok: true });
      expect(validateHoneypot("")).toEqual({ ok: true });
      expect(validateHoneypot("   ")).toEqual({ ok: true });
    });

    it("rejects non-empty honeypot values as bot submissions", () => {
      const result = validateHoneypot("spam bot text");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("HONEYPOT_TRIGGERED");
      }
    });
  });

  describe("validateOrderQuantities", () => {
    const validProductId1 = "11111111-1111-4111-8111-111111111111";
    const validProductId2 = "22222222-2222-4222-8222-222222222222";

    it("accepts valid line and total quantities under thresholds", () => {
      const result = validateOrderQuantities([
        { productId: validProductId1, quantity: 10 },
        { productId: validProductId2, quantity: 20 },
      ]);
      expect(result.ok).toBe(true);
    });

    it("accepts exact boundary values", () => {
      const result = validateOrderQuantities([
        { productId: validProductId1, quantity: MAX_QUANTITY_PER_LINE },
        { productId: validProductId2, quantity: MAX_QUANTITY_PER_ORDER - MAX_QUANTITY_PER_LINE },
      ]);
      expect(result.ok).toBe(true);
    });

    it("rejects when a single line quantity exceeds MAX_QUANTITY_PER_LINE", () => {
      const result = validateOrderQuantities([
        { productId: validProductId1, quantity: MAX_QUANTITY_PER_LINE + 1 },
      ]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("MAX_LINE_QUANTITY_EXCEEDED");
        expect(result.productId).toBe(validProductId1);
        expect(result.message).toContain(String(MAX_QUANTITY_PER_LINE));
      }
    });

    it("rejects when total order quantity exceeds MAX_QUANTITY_PER_ORDER across multiple lines", () => {
      const result = validateOrderQuantities([
        { productId: validProductId1, quantity: 45 },
        { productId: validProductId2, quantity: 45 },
        { productId: "33333333-3333-4333-8333-333333333333", quantity: 15 },
      ]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("MAX_ORDER_QUANTITY_EXCEEDED");
        expect(result.message).toContain(String(MAX_QUANTITY_PER_ORDER));
      }
    });
  });

  describe("hashIdentifier", () => {
    it("returns consistent, non-empty truncated hash", () => {
      const h1 = hashIdentifier("+33612345678");
      const h2 = hashIdentifier("+33612345678");
      const h3 = hashIdentifier("+33612345679");

      expect(h1).toBe(h2);
      expect(h1).not.toBe(h3);
      expect(h1.length).toBeGreaterThan(4);
      expect(h1).not.toContain("+33612345678");
    });
  });

  describe("logAntiAbuseRejection", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("logs rejection without any unmasked personal data", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const event: AntiAbuseRejectionEvent = {
        reason: "honeypot",
        ip: "192.168.1.50",
        phone: "+33612345678",
      };

      logAntiAbuseRejection(event);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [msg, payload] = warnSpy.mock.calls[0];
      expect(msg).toContain("[anti-abuse]");
      expect(JSON.stringify(payload)).not.toContain("192.168.1.50");
      expect(JSON.stringify(payload)).not.toContain("+33612345678");
      expect(payload).toHaveProperty("reason", "honeypot");
      expect(payload).toHaveProperty("ipHash");
      expect(payload).toHaveProperty("phoneHash");
    });
  });
});

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it("allows requests up to the configured limit within a window", () => {
    const key = "test-ip-key";
    for (let i = 0; i < RATE_LIMIT_IP_MAX_REQUESTS; i++) {
      const check = limiter.check(key, RATE_LIMIT_IP_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
      expect(check.allowed).toBe(true);
    }

    const blocked = limiter.check(key, RATE_LIMIT_IP_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("enforces separate limits for different keys", () => {
    const key1 = "ip-1";
    const key2 = "ip-2";

    for (let i = 0; i < RATE_LIMIT_IP_MAX_REQUESTS; i++) {
      limiter.check(key1, RATE_LIMIT_IP_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
    }

    expect(limiter.check(key1, RATE_LIMIT_IP_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS).allowed).toBe(
      false,
    );
    expect(limiter.check(key2, RATE_LIMIT_IP_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS).allowed).toBe(
      true,
    );
  });

  it("allows phone-specific limits", () => {
    const phoneKey = "phone-norm";
    for (let i = 0; i < RATE_LIMIT_PHONE_MAX_REQUESTS; i++) {
      const check = limiter.check(phoneKey, RATE_LIMIT_PHONE_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
      expect(check.allowed).toBe(true);
    }

    const blocked = limiter.check(phoneKey, RATE_LIMIT_PHONE_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
    expect(blocked.allowed).toBe(false);
  });

  it("resets counters after reset() is called", () => {
    const key = "test-reset";
    for (let i = 0; i < RATE_LIMIT_IP_MAX_REQUESTS; i++) {
      limiter.check(key, RATE_LIMIT_IP_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
    }
    expect(limiter.check(key, RATE_LIMIT_IP_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS).allowed).toBe(
      false,
    );

    limiter.reset();
    expect(limiter.check(key, RATE_LIMIT_IP_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS).allowed).toBe(true);
  });
});
