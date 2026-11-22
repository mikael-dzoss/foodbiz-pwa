import { describe, expect, it } from "vitest";
import {
  reserveStock,
  restoreStock,
  validateOrderLineStock,
  validateOrderStock,
  getStockStatus,
  calculateStockAdjustment,
  type StockProduct,
} from "../index";

const validUuid1 = "11111111-1111-4111-8111-111111111111";
const validUuid2 = "22222222-2222-4111-8111-222222222222";

describe("Stock rules and negative inventory prevention", () => {
  const inStockProduct: StockProduct = {
    id: validUuid1,
    name: "Croissant",
    stock: 5,
    visible: true,
  };

  const hiddenProduct: StockProduct = {
    id: validUuid2,
    name: "Secret Recipe Pastry",
    stock: 10,
    visible: false,
  };

  describe("validateOrderLineStock", () => {
    it("allows ordering when stock is sufficient and product is visible", () => {
      const result = validateOrderLineStock(inStockProduct, 3);
      expect(result).toEqual({
        ok: true,
        productId: validUuid1,
        productName: "Croissant",
        requestedQuantity: 3,
        availableStock: 5,
        remainingStock: 2,
      });
    });

    it("rejects when quantity exceeds available stock with per-line details", () => {
      const result = validateOrderLineStock(inStockProduct, 6);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INSUFFICIENT_STOCK");
        expect(result.error.productId).toBe(validUuid1);
        expect(result.error.productName).toBe("Croissant");
        expect(result.error.requestedQuantity).toBe(6);
        expect(result.error.availableStock).toBe(5);
        expect(result.error.message).toMatch(/insufficient stock/i);
      }
    });

    it("rejects hidden products even if stock is available", () => {
      const result = validateOrderLineStock(hiddenProduct, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PRODUCT_HIDDEN");
        expect(result.error.productId).toBe(validUuid2);
        expect(result.error.message).toMatch(/hidden/i);
      }
    });

    it("rejects invalid quantities (zero, negative, non-integers)", () => {
      expect(validateOrderLineStock(inStockProduct, 0).ok).toBe(false);
      expect(validateOrderLineStock(inStockProduct, -2).ok).toBe(false);
      expect(validateOrderLineStock(inStockProduct, 1.5).ok).toBe(false);
    });
  });

  describe("validateOrderStock (multi-line orders)", () => {
    it("returns ok when all items have sufficient stock", () => {
      const items = [
        { product: inStockProduct, quantity: 2 },
        { product: { ...inStockProduct, id: validUuid2, name: "Baguette", stock: 3 }, quantity: 3 },
      ];
      const result = validateOrderStock(items);
      expect(result).toEqual({ ok: true });
    });

    it("accumulates per-line errors without silent truncation", () => {
      const items = [
        { product: inStockProduct, quantity: 10 }, // exceeds stock
        { product: hiddenProduct, quantity: 1 }, // hidden
      ];
      const result = validateOrderStock(items);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0].code).toBe("INSUFFICIENT_STOCK");
        expect(result.errors[1].code).toBe("PRODUCT_HIDDEN");
      }
    });
  });

  describe("reserveStock", () => {
    it("reserves stock and returns updated product with remaining stock", () => {
      const result = reserveStock(inStockProduct, 2);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.remainingStock).toBe(3);
        expect(result.product.stock).toBe(3);
        // Original product is not mutated
        expect(inStockProduct.stock).toBe(5);
      }
    });

    it("prevents stock from going below zero", () => {
      const result = reserveStock(inStockProduct, 6);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INSUFFICIENT_STOCK");
      }
    });
  });

  describe("restoreStock", () => {
    it("restores stock on order cancellation/rejection", () => {
      const lowStockProduct = { ...inStockProduct, stock: 1 };
      const result = restoreStock(lowStockProduct, 3);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.updatedStock).toBe(4);
        expect(result.product.stock).toBe(4);
        expect(lowStockProduct.stock).toBe(1);
      }
    });

    it("rejects non-positive restoration quantities", () => {
      const resZero = restoreStock(inStockProduct, 0);
      expect(resZero.ok).toBe(false);

      const resNeg = restoreStock(inStockProduct, -1);
      expect(resNeg.ok).toBe(false);
    });
  });

  describe("getStockStatus", () => {
    it("returns 'out_of_stock' when stock is 0 or negative", () => {
      expect(getStockStatus(0, 5)).toBe("out_of_stock");
      expect(getStockStatus(-2, 5)).toBe("out_of_stock");
    });

    it("returns 'low_stock' when stock is at or below threshold", () => {
      expect(getStockStatus(1, 5)).toBe("low_stock");
      expect(getStockStatus(3, 5)).toBe("low_stock");
      expect(getStockStatus(5, 5)).toBe("low_stock");
    });

    it("returns 'in_stock' when stock exceeds threshold", () => {
      expect(getStockStatus(6, 5)).toBe("in_stock");
      expect(getStockStatus(20, 5)).toBe("in_stock");
    });
  });

  describe("calculateStockAdjustment", () => {
    it("adjusts stock by positive or negative delta but prevents negative stock", () => {
      expect(calculateStockAdjustment(10, 5)).toBe(15);
      expect(calculateStockAdjustment(10, -5)).toBe(5);
      expect(calculateStockAdjustment(10, -10)).toBe(0);
      expect(calculateStockAdjustment(10, -15)).toBe(0);
    });
  });
});
