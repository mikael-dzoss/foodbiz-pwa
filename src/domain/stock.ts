import type { Product } from "./product";

export type StockProduct = Pick<Product, "id" | "name" | "stock" | "visible">;

export type StockLineErrorCode = "INSUFFICIENT_STOCK" | "PRODUCT_HIDDEN" | "INVALID_QUANTITY";

export interface StockLineError {
  productId: string;
  productName: string;
  requestedQuantity: number;
  availableStock: number;
  code: StockLineErrorCode;
  message: string;
}

export type StockLineValidationResult =
  | {
      ok: true;
      productId: string;
      productName: string;
      requestedQuantity: number;
      availableStock: number;
      remainingStock: number;
    }
  | {
      ok: false;
      error: StockLineError;
    };

export type OrderStockValidationResult = { ok: true } | { ok: false; errors: StockLineError[] };

/**
 * Validates whether an order line item can be fulfilled given product stock and visibility.
 */
export function validateOrderLineStock(
  product: StockProduct,
  quantity: number,
): StockLineValidationResult {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return {
      ok: false,
      error: {
        productId: product.id,
        productName: product.name,
        requestedQuantity: quantity,
        availableStock: product.stock,
        code: "INVALID_QUANTITY",
        message: `Quantity for "${product.name}" must be a positive integer.`,
      },
    };
  }

  if (!product.visible) {
    return {
      ok: false,
      error: {
        productId: product.id,
        productName: product.name,
        requestedQuantity: quantity,
        availableStock: product.stock,
        code: "PRODUCT_HIDDEN",
        message: `Product "${product.name}" is hidden and cannot be ordered.`,
      },
    };
  }

  if (product.stock < quantity) {
    return {
      ok: false,
      error: {
        productId: product.id,
        productName: product.name,
        requestedQuantity: quantity,
        availableStock: product.stock,
        code: "INSUFFICIENT_STOCK",
        message: `Insufficient stock for "${product.name}": requested ${quantity}, available ${product.stock}.`,
      },
    };
  }

  return {
    ok: true,
    productId: product.id,
    productName: product.name,
    requestedQuantity: quantity,
    availableStock: product.stock,
    remainingStock: product.stock - quantity,
  };
}

/**
 * Validates a multi-line order against stock availability, returning all per-line errors.
 */
export function validateOrderStock(
  items: Array<{ product: StockProduct; quantity: number }>,
): OrderStockValidationResult {
  const errors: StockLineError[] = [];

  for (const item of items) {
    const res = validateOrderLineStock(item.product, item.quantity);
    if (!res.ok) {
      errors.push(res.error);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

/**
 * Reserves stock for an order item, decrementing product stock without mutating the original.
 */
export function reserveStock<T extends StockProduct>(
  product: T,
  quantity: number,
): { ok: true; product: T; remainingStock: number } | { ok: false; error: StockLineError } {
  const check = validateOrderLineStock(product, quantity);
  if (!check.ok) {
    return { ok: false, error: check.error };
  }

  return {
    ok: true,
    product: {
      ...product,
      stock: check.remainingStock,
    },
    remainingStock: check.remainingStock,
  };
}

/**
 * Restores stock when an order is cancelled or rejected, incrementing without mutating.
 */
export function restoreStock<T extends StockProduct>(
  product: T,
  quantity: number,
): { ok: true; product: T; updatedStock: number } | { ok: false; error: string } {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return {
      ok: false,
      error: "Quantity to restore must be a positive integer.",
    };
  }

  const updatedStock = product.stock + quantity;
  return {
    ok: true,
    product: {
      ...product,
      stock: updatedStock,
    },
    updatedStock,
  };
}
