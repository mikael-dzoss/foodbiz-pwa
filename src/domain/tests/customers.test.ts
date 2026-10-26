import { describe, expect, it } from "vitest";
import { summarizeCustomers, updateCustomerInputSchema } from "../customers";
import { demoGuests } from "@/lib/repositories/mock/fixtures/guests";
import { demoOrders } from "@/lib/repositories/mock/fixtures/orders";

describe("customer summaries", () => {
  it("joins by guestId, counts all orders, and sums only paid non-cancelled orders", () => {
    const guest = demoGuests[0];
    const orders = [
      { ...demoOrders[0], guestId: guest.id, paid: "paid" as const, totalAmount: 1200 },
      { ...demoOrders[1], guestId: guest.id, paid: "unpaid" as const, totalAmount: 2000 },
      { ...demoOrders[2], guestId: guest.id, paid: "refunded" as const, totalAmount: 3000 },
      { ...demoOrders[3], guestId: guest.id, paid: "paid" as const, status: "CANCELLED" as const },
      { ...demoOrders[0], guestId: demoGuests[1].id, totalAmount: 9999 },
    ];
    const [summary] = summarizeCustomers([guest], orders);
    expect(summary).toMatchObject({
      guest,
      orderCount: 4,
      totalSpent: 1200,
      lastOrderDate: orders
        .map((o) => o.createdAt)
        .slice(0, 4)
        .sort()
        .at(-1),
    });
    expect(orders[0].guestId).toBe(guest.id);
  });

  it("keeps customers without orders with zero totals and no last order date", () => {
    expect(summarizeCustomers([demoGuests[0]], [])).toEqual([
      { guest: demoGuests[0], orderCount: 0, totalSpent: 0, lastOrderDate: null },
    ]);
  });
});

describe("customer edits", () => {
  it("normalizes the canonical name and trims notes without accepting identity changes", () => {
    expect(
      updateCustomerInputSchema.parse({
        id: demoGuests[0].id,
        name: "  Alex   Martin  ",
        notes: "  Call before delivery  ",
      }),
    ).toEqual({ id: demoGuests[0].id, name: "Alex Martin", notes: "Call before delivery" });
    expect(
      updateCustomerInputSchema.safeParse({
        id: demoGuests[0].id,
        name: "Alex",
        notes: "",
        businessId: demoGuests[0].businessId,
      }).success,
    ).toBe(false);
  });

  it("rejects invalid IDs, names and excessive notes", () => {
    const valid = { id: demoGuests[0].id, name: "Alex", notes: "" };
    for (const patch of [
      { id: "bad-id" },
      { name: " " },
      { name: "A\nB" },
      { name: "x".repeat(51) },
      { notes: "x".repeat(2001) },
    ]) {
      expect(updateCustomerInputSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
    }
  });
});
