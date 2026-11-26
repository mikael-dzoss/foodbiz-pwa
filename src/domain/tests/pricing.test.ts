import { describe, expect, it } from "vitest";
import { calculateOrderItemTotal, calculateOrderTotals, type PricingLineItem } from "../index";

const validUuid1 = "11111111-1111-4111-8111-111111111111";
const validUuid2 = "22222222-2222-4111-8111-222222222222";

describe("Order pricing and totals", () => {
  describe("calculateOrderItemTotal", () => {
    it("calculates item total in integer cents", () => {
      expect(calculateOrderItemTotal(2, 250)).toBe(500);
      expect(calculateOrderItemTotal(3, 333)).toBe(999);
      expect(calculateOrderItemTotal(0, 100)).toBe(0);
    });

    it("throws on invalid quantities or prices", () => {
      expect(() => calculateOrderItemTotal(-1, 200)).toThrow();
      expect(() => calculateOrderItemTotal(1.5, 200)).toThrow();
      expect(() => calculateOrderItemTotal(1, -50)).toThrow();
    });
  });

  describe("calculateOrderTotals", () => {
    const items: PricingLineItem[] = [
      {
        productId: validUuid1,
        productName: "Poulet Braisé",
        quantity: 2,
        unitPrice: 250, // 2 * 250 = 500 cents (€5.00)
      },
      {
        productId: validUuid2,
        productName: "Coffee",
        quantity: 1,
        unitPrice: 350, // 1 * 350 = 350 cents (€3.50)
      },
    ];

    it("calculates subtotal and total for pickup with 0 delivery fee", () => {
      const result = calculateOrderTotals({
        items,
        serviceType: "pickup",
        deliveryFee: 200, // Should be ignored for pickup
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.subtotal).toBe(850);
        expect(result.deliveryFee).toBe(0);
        expect(result.total).toBe(850);
        expect(result.items[0].totalPrice).toBe(500);
        expect(result.items[1].totalPrice).toBe(350);
      }
    });

    it("adds the relay pickup fee for pickup orders only", () => {
      const pickup = calculateOrderTotals({ items, serviceType: "pickup", pickupFee: 150 });
      expect(pickup.ok && pickup.pickupFee).toBe(150);
      expect(pickup.ok && pickup.total).toBe(1000);

      const delivery = calculateOrderTotals({
        items,
        serviceType: "delivery",
        deliveryFee: 250,
        pickupFee: 150,
      });
      expect(delivery.ok && delivery.pickupFee).toBe(0);
      expect(delivery.ok && delivery.total).toBe(1100);
    });

    it("ignores a negative pickup fee and keeps the minimum on the items subtotal", () => {
      const free = calculateOrderTotals({ items, serviceType: "pickup", pickupFee: -50 });
      expect(free.ok && free.total).toBe(850);

      const tooSmall = calculateOrderTotals({
        items,
        serviceType: "pickup",
        pickupFee: 500,
        minimumOrderAmount: 900,
      });
      expect(tooSmall.ok).toBe(false);
    });

    it("calculates subtotal, delivery fee, and total for delivery in integer cents", () => {
      const result = calculateOrderTotals({
        items,
        serviceType: "delivery",
        deliveryFee: 250,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.subtotal).toBe(850);
        expect(result.deliveryFee).toBe(250);
        expect(result.total).toBe(1100);
      }
    });

    it("rejects when subtotal does not meet minimum order amount", () => {
      const result = calculateOrderTotals({
        items,
        serviceType: "delivery",
        deliveryFee: 500,
        minimumOrderAmount: 1000, // subtotal is 850 < 1000
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("MINIMUM_ORDER_AMOUNT");
        expect(result.subtotal).toBe(850);
        expect(result.minimumOrderAmount).toBe(1000);
        expect(result.shortfall).toBe(150);
      }
    });

    it("passes minimum order amount check when subtotal meets the threshold exactly", () => {
      const result = calculateOrderTotals({
        items,
        serviceType: "delivery",
        deliveryFee: 300,
        minimumOrderAmount: 850,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.total).toBe(1150);
      }
    });

    it("does not allow deliveryFee to offset food subtotal towards minimum order", () => {
      // Subtotal 500 + deliveryFee 600 = total 1100. Minimum 1000.
      // Must fail because subtotal (500) < minimum (1000)!
      const singleItem: PricingLineItem[] = [
        {
          productId: validUuid1,
          productName: "Cake Slice",
          quantity: 1,
          unitPrice: 500,
        },
      ];
      const result = calculateOrderTotals({
        items: singleItem,
        serviceType: "delivery",
        deliveryFee: 600,
        minimumOrderAmount: 1000,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("MINIMUM_ORDER_AMOUNT");
        expect(result.subtotal).toBe(500);
        expect(result.shortfall).toBe(500);
      }
    });

    it("handles rounding edge cases with integer arithmetic", () => {
      const edgeItems: PricingLineItem[] = [
        { productId: validUuid1, productName: "Item A", quantity: 3, unitPrice: 333 },
        { productId: validUuid2, productName: "Item B", quantity: 7, unitPrice: 142 },
      ];
      const result = calculateOrderTotals({
        items: edgeItems,
        serviceType: "pickup",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // 3 * 333 = 999, 7 * 142 = 994 -> subtotal = 1993
        expect(result.subtotal).toBe(1993);
        expect(result.total).toBe(1993);
      }
    });

    it("defaults deliveryFee to 0 when omitted for delivery service", () => {
      const result = calculateOrderTotals({
        items,
        serviceType: "delivery",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.deliveryFee).toBe(0);
        expect(result.total).toBe(850);
      }
    });

    it("respects precomputed totalPrice on items when provided", () => {
      const precomputed = [
        {
          productId: validUuid1,
          productName: "Discounted Item",
          quantity: 2,
          unitPrice: 500,
          totalPrice: 800, // custom bundle price
        },
      ];
      const result = calculateOrderTotals({
        items: precomputed,
        serviceType: "pickup",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.subtotal).toBe(800);
      }
    });
  });
});
