import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";
import type { Order, OrderStatus } from "./order";
import type { Product } from "./product";

export const productQuantitySchema = z.object({
  productId: uuidSchema,
  quantity: z.number().int().positive(),
  lastOrderedAt: isoDateTimeSchema,
});
export type ProductQuantity = z.infer<typeof productQuantitySchema>;

export interface ProductQuantityFilter {
  readonly fromDate: string;
  readonly toDate: string;
  readonly excludeStatuses?: readonly OrderStatus[];
}

// CANCELLED is the only rejected-equivalent order status; refunds use paid, not status.
export const FEATURED_EXCLUDED_STATUSES: readonly OrderStatus[] = ["CANCELLED"];

export function featuredDateRange(now: Date, days: 7 | 30): ProductQuantityFilter {
  return {
    fromDate: new Date(now.getTime() - days * 86_400_000).toISOString(),
    toDate: now.toISOString(),
    excludeStatuses: FEATURED_EXCLUDED_STATUSES,
  };
}

/** Inclusive createdAt window, never requested delivery date. No order/guest fields escape. */
export function sumOrderProductQuantities(
  orders: readonly Order[],
  { fromDate, toDate, excludeStatuses = [] }: ProductQuantityFilter,
): ProductQuantity[] {
  const from = Date.parse(fromDate);
  const to = Date.parse(toDate);
  const totals = new Map<string, ProductQuantity>();
  for (const order of orders) {
    const timestamp = Date.parse(order.createdAt);
    if (
      !(timestamp >= from && timestamp <= to) ||
      order.status === "CANCELLED" ||
      order.paid === "refunded" ||
      excludeStatuses.includes(order.status)
    )
      continue;
    for (const item of order.items) {
      const previous = totals.get(item.productId);
      totals.set(item.productId, {
        productId: item.productId,
        quantity: (previous?.quantity ?? 0) + item.quantity,
        lastOrderedAt:
          previous && Date.parse(previous.lastOrderedAt) > timestamp
            ? previous.lastOrderedAt
            : order.createdAt,
      });
    }
  }
  return Array.from(totals.values());
}

/** Used by public reads after the repository has stripped orders down to aggregates. */
export function rankFeaturedQuantities(
  products: readonly Product[],
  quantities: readonly ProductQuantity[],
): Product[] {
  const totals = new Map(quantities.map((q) => [q.productId, q]));
  return products
    .filter((p) => p.visible && p.stock > 0 && (totals.get(p.id)?.quantity ?? 0) > 0)
    .toSorted((a, b) => {
      const aTotal = totals.get(a.id)!;
      const bTotal = totals.get(b.id)!;
      return (
        bTotal.quantity - aTotal.quantity ||
        Date.parse(bTotal.lastOrderedAt) - Date.parse(aTotal.lastOrderedAt) ||
        a.name.localeCompare(b.name, "en") ||
        a.id.localeCompare(b.id, "en")
      );
    })
    .slice(0, 6);
}

/** Pure reference ranking: 7 trailing days, 30 only if no eligible product remains. */
export function rankFeaturedProducts(
  products: readonly Product[],
  orders: readonly Order[],
  now: Date,
): Product[] {
  const recent = rankFeaturedQuantities(
    products,
    sumOrderProductQuantities(orders, featuredDateRange(now, 7)),
  );
  return recent.length > 0
    ? recent
    : rankFeaturedQuantities(
        products,
        sumOrderProductQuantities(orders, featuredDateRange(now, 30)),
      );
}
