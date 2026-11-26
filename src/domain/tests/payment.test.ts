import { describe, expect, it } from "vitest";
import {
  canChangePaymentStatus,
  markOrderPaid,
  markOrderUnpaid,
  paymentMethodSchema,
  paymentPreferenceSchema,
  validatePaymentState,
  type Order,
  type OrderStatus,
  type PaymentMethod,
} from "../index";

const isoNow = "2026-10-09T14:00:00.000Z";
const validUuid = "11111111-1111-4111-8111-111111111111";

function createMockOrder(overrides?: Partial<Order>): Order {
  return {
    id: validUuid,
    businessId: validUuid,
    guestId: validUuid,
    serviceType: "pickup",
    channel: "storefront",
    status: "NEW",
    paid: "unpaid",
    paymentPreference: "on_handover",
    paymentMethod: null,
    paidAt: null,
    requestedDate: "2026-10-10",
    items: [
      {
        productId: validUuid,
        productName: "Poulet Braisé",
        quantity: 2,
        unitPrice: 150,
        totalPrice: 300,
      },
    ],
    totalAmount: 300,
    createdAt: isoNow,
    updatedAt: isoNow,
    ...overrides,
  };
}

describe("Payment model and rules", () => {
  describe("paymentPreferenceSchema", () => {
    it("accepts revolut, wero, on_handover", () => {
      expect(paymentPreferenceSchema.safeParse("revolut").success).toBe(true);
      expect(paymentPreferenceSchema.safeParse("wero").success).toBe(true);
      expect(paymentPreferenceSchema.safeParse("on_handover").success).toBe(true);
    });

    it("rejects unsupported preferences", () => {
      expect(paymentPreferenceSchema.safeParse("cash").success).toBe(false);
      expect(paymentPreferenceSchema.safeParse("card").success).toBe(false);
      expect(paymentPreferenceSchema.safeParse("").success).toBe(false);
      expect(paymentPreferenceSchema.safeParse(null).success).toBe(false);
    });
  });

  describe("paymentMethodSchema", () => {
    it("accepts cash, card, revolut, wero", () => {
      expect(paymentMethodSchema.safeParse("cash").success).toBe(true);
      expect(paymentMethodSchema.safeParse("card").success).toBe(true);
      expect(paymentMethodSchema.safeParse("revolut").success).toBe(true);
      expect(paymentMethodSchema.safeParse("wero").success).toBe(true);
    });

    it("rejects unsupported methods", () => {
      expect(paymentMethodSchema.safeParse("on_handover").success).toBe(false);
      expect(paymentMethodSchema.safeParse("crypto").success).toBe(false);
      expect(paymentMethodSchema.safeParse("").success).toBe(false);
    });
  });

  describe("markOrderPaid", () => {
    it("marks order as paid with card method", () => {
      const order = createMockOrder({ paid: "unpaid" });
      const result = markOrderPaid(order, {
        paymentMethod: "card",
        paidAt: "2026-10-09T14:30:00.000Z",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.order.paid).toBe("paid");
        expect(result.order.paymentMethod).toBe("card");
      }
    });

    it("marks order as paid with provided method and timestamp", () => {
      const order = createMockOrder({ paid: "unpaid" });
      const result = markOrderPaid(order, {
        paymentMethod: "cash",
        paidAt: "2026-10-09T14:30:00.000Z",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.order.paid).toBe("paid");
        expect(result.order.paymentMethod).toBe("cash");
        expect(result.order.paidAt).toBe("2026-10-09T14:30:00.000Z");
      }
    });

    it("defaults paidAt to an ISO datetime when not explicitly provided", () => {
      const order = createMockOrder({ paid: "unpaid" });
      const result = markOrderPaid(order, { paymentMethod: "revolut" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.order.paid).toBe("paid");
        expect(result.order.paymentMethod).toBe("revolut");
        expect(result.order.paidAt).toBeDefined();
        expect(typeof result.order.paidAt).toBe("string");
        expect(new Date(result.order.paidAt!).toISOString()).toBe(result.order.paidAt);
      }
    });

    it("does not mutate original order", () => {
      const order = createMockOrder({ paid: "unpaid", paymentMethod: null, paidAt: null });
      const result = markOrderPaid(order, { paymentMethod: "wero" });

      expect(result.ok).toBe(true);
      expect(order.paid).toBe("unpaid");
      expect(order.paymentMethod).toBeNull();
      expect(order.paidAt).toBeNull();
    });

    it("rejects when paymentMethod is missing or invalid", () => {
      const order = createMockOrder();
      const noMethod = markOrderPaid(order, {} as { paymentMethod: PaymentMethod });
      expect(noMethod.ok).toBe(false);
      if (!noMethod.ok) {
        expect(noMethod.error).toMatch(/payment method/i);
      }

      const invalidMethod = markOrderPaid(order, {
        paymentMethod: "crypto" as unknown as PaymentMethod,
      });
      expect(invalidMethod.ok).toBe(false);
      if (!invalidMethod.ok) {
        expect(invalidMethod.error).toMatch(/payment method/i);
      }
    });

    it("rejects when paidAt is invalid format", () => {
      const order = createMockOrder();
      const res = markOrderPaid(order, {
        paymentMethod: "cash",
        paidAt: "invalid-timestamp",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/paidAt/i);
      }
    });
  });

  describe("markOrderUnpaid", () => {
    it("clears paymentMethod and paidAt when marked unpaid", () => {
      const paidOrder = createMockOrder({
        paid: "paid",
        paymentMethod: "revolut",
        paidAt: isoNow,
      });

      const result = markOrderUnpaid(paidOrder);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.order.paid).toBe("unpaid");
        expect(result.order.paymentMethod).toBeNull();
        expect(result.order.paidAt).toBeNull();
      }
    });

    it("does not mutate original order", () => {
      const paidOrder = createMockOrder({
        paid: "paid",
        paymentMethod: "wero",
        paidAt: isoNow,
      });

      const result = markOrderUnpaid(paidOrder);
      expect(result.ok).toBe(true);
      expect(paidOrder.paid).toBe("paid");
      expect(paidOrder.paymentMethod).toBe("wero");
      expect(paidOrder.paidAt).toBe(isoNow);
    });
  });

  describe("Payment status and order lifecycle rules", () => {
    const validStatuses: OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "READY", "COMPLETED"];

    for (const status of validStatuses) {
      it(`allows markOrderPaid in status ${status} without altering status`, () => {
        expect(canChangePaymentStatus(status)).toBe(true);

        const order = createMockOrder({ status, paid: "unpaid" });
        const res = markOrderPaid(order, { paymentMethod: "cash" });

        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.order.status).toBe(status);
          expect(res.order.paid).toBe("paid");
        }
      });

      it(`allows markOrderUnpaid in status ${status} without altering status`, () => {
        const order = createMockOrder({
          status,
          paid: "paid",
          paymentMethod: "cash",
          paidAt: isoNow,
        });
        const res = markOrderUnpaid(order);

        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.order.status).toBe(status);
          expect(res.order.paid).toBe("unpaid");
        }
      });
    }

    it("rejects markOrderPaid when order status is CANCELLED (AC: Payment can be recorded at any status except CANCELLED)", () => {
      expect(canChangePaymentStatus("CANCELLED")).toBe(false);

      const order = createMockOrder({ status: "CANCELLED", paid: "unpaid" });
      const res = markOrderPaid(order, { paymentMethod: "cash" });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/cancelled/i);
      }
    });
  });

  describe("validatePaymentState", () => {
    it("passes for valid paid order", () => {
      const res = validatePaymentState({
        paid: "paid",
        paymentMethod: "cash",
        paidAt: isoNow,
      });
      expect(res).toEqual({ ok: true });
    });

    it("fails for paid order missing paymentMethod", () => {
      const res = validatePaymentState({
        paid: "paid",
        paymentMethod: null,
        paidAt: isoNow,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/payment method/i);
      }
    });

    it("fails for paid order missing paidAt", () => {
      const res = validatePaymentState({
        paid: "paid",
        paymentMethod: "revolut",
        paidAt: null,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/paidAt/i);
      }
    });

    it("passes for valid unpaid order", () => {
      const res = validatePaymentState({
        paid: "unpaid",
        paymentMethod: null,
        paidAt: null,
      });
      expect(res).toEqual({ ok: true });
    });
  });
});
