import type { ServiceType } from "./order";

export interface PricingLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
}

export interface MinimumOrderAmountError {
  ok: false;
  code: "MINIMUM_ORDER_AMOUNT";
  message: string;
  subtotal: number;
  minimumOrderAmount: number;
  shortfall: number;
}

export interface OrderTotalsSuccess {
  ok: true;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: Array<Required<PricingLineItem>>;
}

export type OrderTotalsResult = OrderTotalsSuccess | MinimumOrderAmountError;

export interface CalculateOrderTotalsInput {
  items: readonly PricingLineItem[];
  serviceType: ServiceType;
  deliveryFee?: number;
  minimumOrderAmount?: number;
}

/**
 * Calculates the line total in integer cents for an item given quantity and tax-inclusive unit price.
 */
export function calculateOrderItemTotal(quantity: number, unitPrice: number): number {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error("Quantity must be a non-negative integer.");
  }
  if (!Number.isInteger(unitPrice) || unitPrice < 0) {
    throw new Error("Unit price must be a non-negative integer in cents.");
  }
  return quantity * unitPrice;
}

/**
 * Computes order subtotal, delivery fee (for delivery service only), and total in integer cents,
 * enforcing minimum order amount on the food subtotal.
 */
export function calculateOrderTotals(input: CalculateOrderTotalsInput): OrderTotalsResult {
  const normalizedItems: Array<Required<PricingLineItem>> = input.items.map((item) => {
    const totalPrice =
      item.totalPrice !== undefined
        ? item.totalPrice
        : calculateOrderItemTotal(item.quantity, item.unitPrice);

    return {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice,
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const deliveryFee = input.serviceType === "delivery" ? Math.max(0, input.deliveryFee ?? 0) : 0;
  const minimumOrderAmount = input.minimumOrderAmount ?? 0;

  if (minimumOrderAmount > 0 && subtotal < minimumOrderAmount) {
    return {
      ok: false,
      code: "MINIMUM_ORDER_AMOUNT",
      message: `Minimum order amount is ${minimumOrderAmount} cents (€${(minimumOrderAmount / 100).toFixed(2)}). Current subtotal is ${subtotal} cents (€${(subtotal / 100).toFixed(2)}).`,
      subtotal,
      minimumOrderAmount,
      shortfall: minimumOrderAmount - subtotal,
    };
  }

  const total = subtotal + deliveryFee;

  return {
    ok: true,
    subtotal,
    deliveryFee,
    total,
    items: normalizedItems,
  };
}
