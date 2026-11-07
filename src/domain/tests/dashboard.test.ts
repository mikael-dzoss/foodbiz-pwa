import { describe, expect, it } from "vitest";
import {
  attachGuestNames,
  buildActivityFeed,
  buildDashboardData,
  extractLowStockProducts,
  extractOrdersToPrepare,
  extractUnpaidOrders,
  type Expense,
  type NamedOrder,
  type Product,
} from "../index";

const businessId = "11111111-1111-4111-8111-111111111111";

function makeOrder(overrides: Partial<NamedOrder>): NamedOrder {
  return {
    id: "22222222-2222-4111-8111-222222222222",
    businessId,
    guestId: "77777777-7777-4111-8111-777777777777",
    guestName: "Alice",
    serviceType: "pickup",
    channel: "storefront",
    status: "CONFIRMED",
    paid: "paid",
    paymentPreference: "on_handover",
    paymentMethod: "cash",
    paidAt: "2026-10-15T12:00:00.000Z",
    requestedDate: "2026-10-15",
    requestedTime: "12:30",
    items: [
      {
        productId: "33333333-3333-4111-8111-333333333333",
        productName: "Smash Burger",
        quantity: 2,
        unitPrice: 1200,
        totalPrice: 2400,
      },
    ],
    totalAmount: 2400,
    createdAt: "2026-10-15T10:00:00.000Z",
    updatedAt: "2026-10-15T10:05:00.000Z",
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: "44444444-4444-4111-8111-444444444444",
    businessId,
    amount: 6500,
    date: "2026-10-15",
    description: "Metro Cash & Carry",
    tags: ["Ingredients"],
    createdAt: "2026-10-15T09:00:00.000Z",
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: "55555555-5555-4111-8111-555555555555",
    businessId,
    categoryId: "66666666-6666-4111-8111-666666666666",
    name: "Brioche Buns",
    description: "Fresh buns",
    price: 350,
    unitCost: 100,
    stock: 4,
    visible: true,
    allergens: [],
    suggestAddOns: true,
    imageUrl: null,
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("Dashboard Domain Engine", () => {
  describe("extractOrdersToPrepare", () => {
    it("filters CONFIRMED and PREPARING orders and sorts by scheduled due time", () => {
      const orders = [
        makeOrder({
          id: "o-1",
          orderNumber: 101,
          status: "CONFIRMED",
          requestedDate: "2026-10-15",
          requestedTime: "13:00",
        }),
        makeOrder({
          id: "o-2",
          orderNumber: 102,
          status: "PREPARING",
          requestedDate: "2026-10-15",
          requestedTime: "12:15",
        }),
        makeOrder({
          id: "o-3",
          orderNumber: 103,
          status: "READY",
          requestedDate: "2026-10-15",
          requestedTime: "11:45",
        }),
        makeOrder({
          id: "o-4",
          orderNumber: 104,
          status: "COMPLETED",
          requestedDate: "2026-10-15",
          requestedTime: "11:00",
        }),
        makeOrder({
          id: "o-5",
          orderNumber: 105,
          status: "CANCELLED",
          requestedDate: "2026-10-15",
          requestedTime: "12:00",
        }),
      ];

      const result = extractOrdersToPrepare(orders, 10);
      expect(result.count).toBe(2);
      expect(result.items.map((it) => it.id)).toEqual(["o-2", "o-1"]);
      expect(result.items[0].itemsSummary).toBe("2x Smash Burger");
      expect(result.items[0].itemCount).toBe(2);
    });

    it("respects limit while preserving total count", () => {
      const orders = [
        makeOrder({ id: "o-1", requestedDate: "2026-10-15", requestedTime: "10:00" }),
        makeOrder({ id: "o-2", requestedDate: "2026-10-15", requestedTime: "11:00" }),
        makeOrder({ id: "o-3", requestedDate: "2026-10-15", requestedTime: "12:00" }),
      ];

      const result = extractOrdersToPrepare(orders, 2);
      expect(result.count).toBe(3);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe("o-1");
      expect(result.items[1].id).toBe("o-2");
    });
  });

  describe("extractUnpaidOrders", () => {
    it("extracts unpaid orders and sums their total amount excluding cancelled", () => {
      const orders = [
        makeOrder({
          id: "u-1",
          orderNumber: 201,
          paid: "unpaid",
          status: "CONFIRMED",
          totalAmount: 1850,
          createdAt: "2026-10-15T11:00:00.000Z",
        }),
        makeOrder({
          id: "u-2",
          orderNumber: 202,
          paid: "unpaid",
          status: "READY",
          totalAmount: 3600,
          createdAt: "2026-10-15T11:30:00.000Z",
        }),
        // Cancelled unpaid order - must be excluded
        makeOrder({
          id: "u-3",
          orderNumber: 203,
          paid: "unpaid",
          status: "CANCELLED",
          totalAmount: 5000,
          createdAt: "2026-10-15T09:00:00.000Z",
        }),
        // Paid order - must be excluded
        makeOrder({
          id: "u-4",
          orderNumber: 204,
          paid: "paid",
          status: "COMPLETED",
          totalAmount: 2500,
          createdAt: "2026-10-15T10:00:00.000Z",
        }),
      ];

      const result = extractUnpaidOrders(orders);
      expect(result.count).toBe(2);
      expect(result.totalAmount).toBe(5450); // 1850 + 3600
      expect(result.items[0].id).toBe("u-2"); // newest first
      expect(result.items[1].id).toBe("u-1");
    });
  });

  describe("extractLowStockProducts", () => {
    it("identifies out-of-stock and low-stock products sorted by remaining stock", () => {
      const products = [
        makeProduct({ id: "p-1", name: "Cheese", stock: 12 }), // in_stock (> 5)
        makeProduct({ id: "p-2", name: "Buns", stock: 4 }), // low_stock (<= 5)
        makeProduct({ id: "p-3", name: "Mayo", stock: 0 }), // out_of_stock
        makeProduct({ id: "p-4", name: "Patties", stock: 2 }), // low_stock
      ];

      const result = extractLowStockProducts(products, 5);
      expect(result.count).toBe(3);
      expect(result.items.map((p) => p.name)).toEqual(["Mayo", "Patties", "Buns"]);
      expect(result.items[0].status).toBe("out_of_stock");
      expect(result.items[1].status).toBe("low_stock");
    });
  });

  describe("buildActivityFeed", () => {
    it("merges orders and expenses in chronological descending order", () => {
      const orders = [
        makeOrder({
          id: "o-1",
          orderNumber: 1041,
          createdAt: "2026-10-15T10:00:00.000Z",
          totalAmount: 2400,
          paid: "paid",
        }),
        makeOrder({
          id: "o-2",
          orderNumber: 1042,
          createdAt: "2026-10-15T11:42:00.000Z",
          totalAmount: 3600,
          paid: "unpaid",
        }),
      ];

      const expenses = [
        makeExpense({
          id: "e-1",
          description: "Metro Cash & Carry",
          amount: 6500,
          createdAt: "2026-10-15T11:00:00.000Z",
        }),
      ];

      const feed = buildActivityFeed(orders, expenses, 10);
      expect(feed).toHaveLength(3);
      // Newest first: o-2 (11:42), e-1 (11:00), o-1 (10:00)
      expect(feed[0].id).toBe("o-2");
      expect(feed[0].type).toBe("order");
      expect(feed[0].title).toBe("Order #1042");
      expect(feed[0].statusVariant).toBe("unpaid");

      expect(feed[1].id).toBe("e-1");
      expect(feed[1].type).toBe("expense");
      expect(feed[1].title).toBe("Metro Cash & Carry");
      expect(feed[1].statusVariant).toBe("expense");

      expect(feed[2].id).toBe("o-1");
      expect(feed[2].type).toBe("order");
      expect(feed[2].statusVariant).toBe("paid");
    });

    it("respects limit cap of 10 items", () => {
      const orders = Array.from({ length: 8 }, (_, i) =>
        makeOrder({
          id: `o-${i}`,
          createdAt: `2026-10-15T10:0${i}:00.000Z`,
        }),
      );
      const expenses = Array.from({ length: 8 }, (_, i) =>
        makeExpense({
          id: `e-${i}`,
          createdAt: `2026-10-15T11:0${i}:00.000Z`,
        }),
      );

      const feed = buildActivityFeed(orders, expenses, 10);
      expect(feed).toHaveLength(10);
    });
  });

  describe("buildDashboardData", () => {
    it("generates complete dashboard dataset for requested preset", () => {
      const orders = [
        makeOrder({
          id: "o-1",
          orderNumber: 1041,
          totalAmount: 2000,
          paid: "paid",
          paidAt: "2026-10-15T12:00:00.000Z",
          status: "COMPLETED",
          requestedDate: "2026-10-15",
        }),
      ];
      const expenses = [
        makeExpense({
          id: "e-1",
          amount: 500,
          date: "2026-10-15",
        }),
      ];
      const products = [makeProduct({ id: "p-1", stock: 3 })];

      const data = buildDashboardData({
        orders,
        expenses,
        products,
        periodPreset: "today",
        referenceDate: "2026-10-15",
      });

      expect(data.periodPreset).toBe("today");
      expect(data.period).toEqual({ startDate: "2026-10-15", endDate: "2026-10-15" });
      expect(data.kpis.current.revenue).toBe(2000);
      expect(data.kpis.current.costs).toBe(500);
      expect(data.kpis.current.profit).toBe(1500);
      expect(data.kpis.current.paidOrderCount).toBe(1);
      expect(data.triage.toPrepare.count).toBe(0); // completed order
      expect(data.triage.lowStock.count).toBe(1);
      expect(data.activity).toHaveLength(2);
    });

    it("attachGuestNames resolves guest names via guestId with fallback", () => {
      const { guestName: _omit, ...rawOrder } = makeOrder({
        guestId: "77777777-7777-4111-8111-777777777777",
      });
      void _omit;
      const named = attachGuestNames(
        [rawOrder, { ...rawOrder, id: "o-missing", guestId: "missing-id" }],
        [{ id: "77777777-7777-4111-8111-777777777777", name: "Alice Resolved" }],
      );
      expect(named[0].guestName).toBe("Alice Resolved");
      expect(named[1].guestName).toBe("Unknown guest");
    });
  });
});
