import { describe, expect, it } from "vitest";
import {
  rankFeaturedProducts,
  rankFeaturedQuantities,
  sumOrderProductQuantities,
} from "../featured";
import type { Order } from "../order";
import { demoOrders, demoProducts } from "@/lib/repositories/mock/fixtures";

const now = new Date("2026-11-01T12:00:00.000Z");
const products = demoProducts.slice(0, 8).map((p) => ({ ...p, stock: 10 }));
function order(
  productIndex: number,
  quantity: number,
  createdAt: string,
  patch: Partial<Order> = {},
): Order {
  const product = products[productIndex];
  return {
    ...demoOrders[0],
    status: "COMPLETED",
    paid: "paid",
    createdAt,
    items: [
      {
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        totalPrice: quantity * product.price,
      },
    ],
    ...patch,
  };
}
const recent = "2026-10-31T12:00:00.000Z";

describe("featured products (#204)", () => {
  it("sums quantities and breaks ties by latest order, name, then id without mutating inputs", () => {
    const named = products.map((p, i) => ({ ...p, name: i === 0 ? "Alpha" : "Beta" }));
    const orders = [
      order(0, 2, recent),
      order(0, 3, recent),
      order(1, 5, recent),
      order(2, 5, "2026-11-01T11:00:00.000Z"),
    ];
    const original = structuredClone(orders);
    expect(rankFeaturedProducts(named, orders.toReversed(), now).map((p) => p.id)).toEqual([
      products[2].id,
      products[0].id,
      products[1].id,
    ]);
    expect(orders).toEqual(original);
    expect(
      rankFeaturedQuantities(
        [named[2], named[1]],
        [
          { productId: named[1].id, quantity: 1, lastOrderedAt: recent },
          { productId: named[2].id, quantity: 1, lastOrderedAt: recent },
        ],
      ).map((p) => p.id),
    ).toEqual([named[1].id, named[2].id]);
  });
  it("excludes cancelled and refunded orders, including completed refunds", () => {
    expect(
      rankFeaturedProducts(
        products,
        [
          order(0, 100, recent, { status: "CANCELLED" }),
          order(1, 200, recent, { paid: "refunded" }),
          order(2, 1, recent),
        ],
        now,
      ),
    ).toEqual([products[2]]);
  });
  it("includes exact 7-day and now boundaries, not older or future orders", () => {
    expect(
      rankFeaturedProducts(
        products,
        [
          order(0, 2, "2026-10-25T12:00:00.000Z"),
          order(1, 10, "2026-10-25T11:59:59.999Z"),
          order(2, 1, now.toISOString()),
          order(3, 20, "2026-11-01T12:00:00.001Z"),
        ],
        now,
      ),
    ).toEqual([products[0], products[2]]);
  });
  it("falls back only when no eligible 7-day product exists and includes exactly 30 days", () => {
    const hidden = products.map((p, i) => ({ ...p, visible: i !== 0, stock: i === 1 ? 0 : 10 }));
    expect(
      rankFeaturedProducts(
        hidden,
        [
          order(0, 10, recent),
          order(1, 10, recent),
          order(2, 2, "2026-10-02T12:00:00.000Z"),
          order(3, 20, "2026-10-02T11:59:59.999Z"),
        ],
        now,
      ),
    ).toEqual([hidden[2]]);
  });
  it("excludes products outside the visible list and does not fill a non-empty 7-day list with older items", () => {
    expect(
      rankFeaturedProducts([products[0]], [order(0, 1, recent), order(1, 99, recent)], now),
    ).toEqual([products[0]]);
    expect(
      rankFeaturedProducts(
        products,
        [order(0, 1, recent), order(1, 99, "2026-10-10T12:00:00.000Z")],
        now,
      ),
    ).toEqual([products[0]]);
  });
  it("returns empty for no orders, no products, and orders older than 30 days", () => {
    expect(rankFeaturedProducts(products, [], now)).toEqual([]);
    expect(rankFeaturedProducts([], [order(0, 1, recent)], now)).toEqual([]);
    expect(rankFeaturedProducts(products, [order(0, 1, "2026-10-01T12:00:00.000Z")], now)).toEqual(
      [],
    );
  });
  it("caps the ranking at six", () => {
    expect(
      rankFeaturedProducts(
        products,
        products.map((_, i) => order(i, 8 - i, recent)),
        now,
      ),
    ).toEqual(products.slice(0, 6));
  });
  it("aggregates only requested statuses and exposes no private fields", () => {
    expect(
      sumOrderProductQuantities(
        [
          order(0, 2, recent, { status: "NEW" }),
          order(0, 3, recent),
          order(0, 1, "2026-10-30T12:00:00.000Z"),
        ],
        {
          fromDate: "2026-10-25T12:00:00.000Z",
          toDate: now.toISOString(),
          excludeStatuses: ["NEW"],
        },
      ),
    ).toEqual([{ productId: products[0].id, quantity: 4, lastOrderedAt: recent }]);
    expect(
      rankFeaturedQuantities(products, [
        { productId: products[0].id, quantity: 0, lastOrderedAt: recent },
      ]),
    ).toEqual([]);
  });
});
