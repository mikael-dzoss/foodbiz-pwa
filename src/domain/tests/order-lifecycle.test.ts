import { describe, expect, it } from "vitest";
import {
  ALLOWED_ORDER_TRANSITIONS,
  getNextAllowedStatuses,
  transitionOrderStatus,
  validateOrderTransition,
  type OrderStatus,
  type PaidStatus,
} from "../index";

const ALL_STATUSES: OrderStatus[] = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

describe("Order lifecycle state machine", () => {
  describe("Allowed linear transitions", () => {
    it("allows NEW -> CONFIRMED", () => {
      const res = validateOrderTransition("NEW", "CONFIRMED");
      expect(res).toEqual({ ok: true });
    });

    it("allows CONFIRMED -> PREPARING", () => {
      const res = validateOrderTransition("CONFIRMED", "PREPARING");
      expect(res).toEqual({ ok: true });
    });

    it("allows PREPARING -> READY", () => {
      const res = validateOrderTransition("PREPARING", "READY");
      expect(res).toEqual({ ok: true });
    });

    it("allows READY -> COMPLETED when paid is paid", () => {
      const res = validateOrderTransition("READY", "COMPLETED", { paid: "paid" });
      expect(res).toEqual({ ok: true });
    });

    it("rejects READY -> COMPLETED when paid is unpaid", () => {
      const res = validateOrderTransition("READY", "COMPLETED", { paid: "unpaid" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/unpaid/i);
      }
    });

    it("rejects READY -> COMPLETED when paid status is missing", () => {
      const res = validateOrderTransition("READY", "COMPLETED");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/unpaid/i);
      }
    });
  });

  describe("Cancellation transitions", () => {
    it("allows NEW -> CANCELLED when reason is provided", () => {
      const res = validateOrderTransition("NEW", "CANCELLED", {
        reason: "Customer changed mind",
      });
      expect(res).toEqual({ ok: true });
    });

    it("rejects NEW -> CANCELLED when reason is missing or empty", () => {
      const missingRes = validateOrderTransition("NEW", "CANCELLED");
      expect(missingRes.ok).toBe(false);
      if (!missingRes.ok) {
        expect(missingRes.error).toMatch(/reason/i);
      }

      const emptyRes = validateOrderTransition("NEW", "CANCELLED", { reason: "   " });
      expect(emptyRes.ok).toBe(false);
      if (!emptyRes.ok) {
        expect(emptyRes.error).toMatch(/reason/i);
      }
    });

    it("allows CONFIRMED -> CANCELLED without requiring a reason", () => {
      const res = validateOrderTransition("CONFIRMED", "CANCELLED");
      expect(res).toEqual({ ok: true });
    });

    it("allows PREPARING -> CANCELLED without requiring a reason", () => {
      const res = validateOrderTransition("PREPARING", "CANCELLED");
      expect(res).toEqual({ ok: true });
    });

    it("allows READY -> CANCELLED without requiring a reason", () => {
      const res = validateOrderTransition("READY", "CANCELLED");
      expect(res).toEqual({ ok: true });
    });

    it("rejects COMPLETED -> CANCELLED", () => {
      const res = validateOrderTransition("COMPLETED", "CANCELLED", {
        reason: "Too late",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/cannot transition/i);
      }
    });

    it("rejects CANCELLED -> any other status", () => {
      for (const target of ALL_STATUSES) {
        const res = validateOrderTransition("CANCELLED", target);
        expect(res.ok).toBe(false);
      }
    });
  });

  describe("Full 6x6 transition table", () => {
    const validPairs: Array<{
      from: OrderStatus;
      to: OrderStatus;
      paid?: PaidStatus;
      reason?: string;
    }> = [
      { from: "NEW", to: "CONFIRMED" },
      { from: "NEW", to: "CANCELLED", reason: "Rejected item" },
      { from: "CONFIRMED", to: "PREPARING" },
      { from: "CONFIRMED", to: "CANCELLED" },
      { from: "PREPARING", to: "READY" },
      { from: "PREPARING", to: "CANCELLED" },
      { from: "READY", to: "COMPLETED", paid: "paid" },
      { from: "READY", to: "CANCELLED" },
    ];

    const isValid = (from: OrderStatus, to: OrderStatus) =>
      validPairs.some((p) => p.from === from && p.to === to);

    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (!isValid(from, to)) {
          it(`rejects invalid transition: ${from} -> ${to}`, () => {
            const res = validateOrderTransition(from, to, {
              paid: "paid",
              reason: "Some reason",
            });
            expect(res.ok).toBe(false);
          });
        }
      }
    }
  });

  describe("API polymorphism & helpers", () => {
    it("supports object-style argument invocation", () => {
      const res = validateOrderTransition({
        currentStatus: "PREPARING",
        nextStatus: "READY",
      });
      expect(res).toEqual({ ok: true });
    });

    it("transitionOrderStatus is an alias for validateOrderTransition", () => {
      expect(transitionOrderStatus).toBe(validateOrderTransition);
    });

    it("exposes ALLOWED_ORDER_TRANSITIONS mapping", () => {
      expect(ALLOWED_ORDER_TRANSITIONS.NEW).toEqual(["CONFIRMED", "CANCELLED"]);
      expect(ALLOWED_ORDER_TRANSITIONS.COMPLETED).toEqual([]);
      expect(ALLOWED_ORDER_TRANSITIONS.CANCELLED).toEqual([]);
    });

    it("getNextAllowedStatuses returns correct candidate statuses", () => {
      expect(getNextAllowedStatuses("NEW")).toEqual(["CONFIRMED", "CANCELLED"]);
      expect(getNextAllowedStatuses("COMPLETED")).toEqual([]);
      expect(getNextAllowedStatuses("UNKNOWN" as unknown as OrderStatus)).toEqual([]);
    });

    it("handles unrecognized current status gracefully in transition validation", () => {
      const res = validateOrderTransition("UNKNOWN" as unknown as OrderStatus, "NEW");
      expect(res.ok).toBe(false);
    });
  });
});
