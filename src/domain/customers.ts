import { z } from "zod";
import { uuidSchema } from "./common";
import { guestNameSchema, type Guest } from "./guest";
import type { Order } from "./order";

export const updateCustomerInputSchema = z.strictObject({
  id: uuidSchema,
  name: guestNameSchema,
  notes: z.string().trim().max(2000),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;

export interface CustomerSummary {
  guest: Guest;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
}

export function summarizeCustomers(
  guests: readonly Guest[],
  orders: readonly Order[],
): CustomerSummary[] {
  const summaries = new Map<string, CustomerSummary>(
    guests.map((guest) => [guest.id, { guest, orderCount: 0, totalSpent: 0, lastOrderDate: null }]),
  );
  for (const order of orders) {
    const summary = summaries.get(order.guestId);
    if (!summary || order.businessId !== summary.guest.businessId) continue;
    summaries.set(order.guestId, {
      ...summary,
      orderCount: summary.orderCount + 1,
      totalSpent:
        summary.totalSpent +
        (order.paid === "paid" && order.status !== "CANCELLED" ? order.totalAmount : 0),
      lastOrderDate:
        !summary.lastOrderDate || order.createdAt > summary.lastOrderDate
          ? order.createdAt
          : summary.lastOrderDate,
    });
  }
  return [...summaries.values()];
}
