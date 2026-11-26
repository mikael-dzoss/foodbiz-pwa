import type { ServiceType } from "@/domain/order";
import { calculateOrderTotals } from "@/domain/pricing";

export interface StorefrontPricingItem {
  readonly productId: string;
  readonly name: string;
  readonly quantity: number;
  readonly price: number;
}

export interface StorefrontPricingInput {
  readonly items: readonly StorefrontPricingItem[];
  readonly serviceType: ServiceType;
  readonly deliveryFee?: number;
  readonly pickupFee?: number;
}

export interface StorefrontPricingSuccess {
  readonly ok: true;
  readonly subtotal: number;
  readonly deliveryFee: number;
  readonly pickupFee: number;
  readonly total: number;
}

export interface StorefrontPricingFailure {
  readonly ok: false;
  readonly reason: string;
}

export type StorefrontPricingResult = StorefrontPricingSuccess | StorefrontPricingFailure;

/**
 * Shared storefront pricing helper for Cart and Checkout (#386).
 * Delegates strictly to `calculateOrderTotals` with no hand-rolled fallback math;
 * invalid items or fees return `{ ok: false, reason }` so the UI blocks ordering cleanly.
 */
export function storefrontPricing(input: StorefrontPricingInput): StorefrontPricingResult {
  const deliveryFee = input.deliveryFee ?? 0;
  const pickupFee = input.pickupFee ?? 0;

  if (!Number.isInteger(deliveryFee) || deliveryFee < 0) {
    return { ok: false, reason: "INVALID_DELIVERY_FEE" };
  }
  if (!Number.isInteger(pickupFee) || pickupFee < 0) {
    return { ok: false, reason: "INVALID_PICKUP_FEE" };
  }

  try {
    const result = calculateOrderTotals({
      items: input.items.map((item) => ({
        productId: item.productId,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
      serviceType: input.serviceType,
      deliveryFee,
      pickupFee,
    });

    if (!result.ok) {
      return { ok: false, reason: result.code };
    }

    return {
      ok: true,
      subtotal: result.subtotal,
      deliveryFee: result.deliveryFee,
      pickupFee: result.pickupFee,
      total: result.total,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "PRICING_ERROR",
    };
  }
}
