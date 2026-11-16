import { ALLOWED_ORDER_TRANSITIONS } from "@/domain/order-lifecycle";
import { orderStatusSchema, type Order, type OrderStatus } from "@/domain/order";
import type { Repositories } from "@/domain/repositories";
import { describe, expect, it } from "vitest";

let phoneCounter = 0;
export function nextPhone(): string {
  phoneCounter += 1;
  return `+3361100${String(phoneCounter).padStart(4, "0")}`;
}

/** The product with the most stock: every helper below reserves a few units. */
export async function pickStockedProduct(repos: Repositories, businessId: string) {
  const products = await repos.products.list(businessId);
  return products.filter((p) => p.visible).toSorted((a, b) => b.stock - a.stock)[0];
}

/** Places a manager-channel order (works on mock and live) and returns its id. */
export async function placeOrder(
  repos: Repositories,
  businessId: string,
  items: Array<{ productId: string; quantity: number }>,
  serviceType: "pickup" | "delivery" = "pickup",
): Promise<string> {
  const placed = await repos.orders.place(businessId, {
    guestName: "Contract Customer",
    guestPhone: nextPhone(),
    serviceType,
    channel: "phone",
    requestedDate: "2030-01-01",
    items,
    deliveryAddress: serviceType === "delivery" ? "1 Rue du Test" : null,
  });
  return placed.orderId;
}

/** Walks a fresh, paid order to the given status through the public repository API. */
export async function orderInStatus(
  repos: Repositories,
  businessId: string,
  productId: string,
  status: OrderStatus,
): Promise<string> {
  const id = await placeOrder(repos, businessId, [{ productId, quantity: 1 }]);
  await repos.orders.recordPayment(businessId, id, { paymentMethod: "cash" });
  const path: OrderStatus[] = ["CONFIRMED", "PREPARING", "READY"];
  if (status === "CANCELLED") {
    await repos.orders.cancel(businessId, id, "contract");
    return id;
  }
  let current: OrderStatus = "NEW";
  for (const next of status === "COMPLETED" ? path : path.slice(0, path.indexOf(status) + 1)) {
    if (status === "NEW") break;
    await repos.orders.transition(businessId, id, { expectedStatus: current, nextStatus: next });
    current = next;
  }
  if (status === "COMPLETED") {
    await repos.orders.transition(businessId, id, {
      expectedStatus: "READY",
      nextStatus: "COMPLETED",
    });
  }
  return id;
}

/**
 * Order state changes (lifecycle transitions, payments, refunds, item replacement): the same cases
 * run against the in-memory mock, the mocked Supabase client and the live local database.
 */
export function describeOrderStateContract(
  getRepositories: () => Promise<Repositories> | Repositories,
  businessId: string,
): void {
  describe("OrderRepository state contract", () => {
    it("transition appends to the history, honours expectedStatus and the reason rule", async () => {
      const repos = await getRepositories();
      const product = await pickStockedProduct(repos, businessId);
      const id = await placeOrder(repos, businessId, [{ productId: product.id, quantity: 1 }]);

      const confirmed = await repos.orders.transition(businessId, id, {
        expectedStatus: "NEW",
        nextStatus: "CONFIRMED",
        reason: "accepted",
      });
      expect(confirmed.status).toBe("CONFIRMED");
      expect(confirmed.statusHistory?.at(-1)).toMatchObject({
        status: "CONFIRMED",
        note: "accepted",
      });
      expect(confirmed.statusHistory?.length).toBeGreaterThanOrEqual(2);

      // Stale expected status: optimistic concurrency conflict, nothing changes.
      await expect(
        repos.orders.transition(businessId, id, {
          expectedStatus: "NEW",
          nextStatus: "CONFIRMED",
        }),
      ).rejects.toMatchObject({ code: "ORDER_STATE_CONFLICT" });

      // A new order cannot be rejected without a reason.
      const other = await placeOrder(repos, businessId, [{ productId: product.id, quantity: 1 }]);
      await expect(
        repos.orders.transition(businessId, other, {
          expectedStatus: "NEW",
          nextStatus: "CANCELLED",
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });

      await expect(
        repos.orders.transition(businessId, "00000000-0000-4000-8000-000000000099", {
          expectedStatus: "NEW",
          nextStatus: "CONFIRMED",
        }),
      ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
    });

    it("transition agrees with the domain transition table for every from -> to pair", async () => {
      const repos = await getRepositories();
      const product = await pickStockedProduct(repos, businessId);
      for (const from of orderStatusSchema.options) {
        for (const to of orderStatusSchema.options) {
          const id = await orderInStatus(repos, businessId, product.id, from);
          const attempt = repos.orders.transition(businessId, id, {
            expectedStatus: from,
            nextStatus: to,
            reason: "because",
          });
          if (ALLOWED_ORDER_TRANSITIONS[from].includes(to)) {
            await expect(attempt, `${from} -> ${to} must be allowed`).resolves.toMatchObject({
              status: to,
            });
          } else {
            await expect(attempt, `${from} -> ${to} must be refused`).rejects.toMatchObject({
              code: "INVALID_INPUT",
            });
          }
        }
      }
    });

    it("cancel writes its own history entry and restores stock", async () => {
      const repos = await getRepositories();
      const product = await pickStockedProduct(repos, businessId);
      const before = (await repos.products.findById(businessId, product.id))!.stock;
      const id = await placeOrder(repos, businessId, [{ productId: product.id, quantity: 3 }]);
      await repos.orders.cancel(businessId, id, "no show");
      const order = (await repos.orders.findById(businessId, id)) as Order;
      expect(order.statusHistory?.at(-1)).toMatchObject({ status: "CANCELLED" });
      expect((await repos.products.findById(businessId, product.id))!.stock).toBe(before);
    });

    it("payments: record, undo, refund and their state rules", async () => {
      const repos = await getRepositories();
      const product = await pickStockedProduct(repos, businessId);
      const id = await placeOrder(repos, businessId, [{ productId: product.id, quantity: 1 }]);

      await expect(repos.orders.markUnpaid(businessId, id)).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
      await expect(repos.orders.recordRefund(businessId, id, "x")).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
      await expect(
        repos.orders.recordPayment(businessId, id, { paymentMethod: "wero", markCompleted: true }),
      ).rejects.toMatchObject({ code: "ORDER_STATE_CONFLICT" });

      const paid = await repos.orders.recordPayment(businessId, id, { paymentMethod: "wero" });
      expect(paid).toMatchObject({ paid: "paid", paymentMethod: "wero" });
      expect(paid.paidAt).toBeTruthy();

      const unpaid = await repos.orders.markUnpaid(businessId, id);
      expect(unpaid).toMatchObject({ paid: "unpaid", paymentMethod: null, paidAt: null });
      expect(unpaid.statusHistory?.at(-1)?.note).toBe("Payment marked as unpaid (undone)");

      await repos.orders.recordPayment(businessId, id, { paymentMethod: "cash" });
      const refunded = await repos.orders.recordRefund(businessId, id, "dispute");
      expect(refunded.paid).toBe("refunded");
      expect(refunded.refundedAt).toBeTruthy();
      expect(refunded.statusHistory?.at(-1)?.note).toBe("Refund recorded: dispute");

      // A refunded order cannot be paid again, refunded again or marked unpaid.
      await expect(
        repos.orders.recordPayment(businessId, id, { paymentMethod: "cash" }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(repos.orders.recordRefund(businessId, id)).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
      await expect(repos.orders.markUnpaid(businessId, id)).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });

      // No payment on a cancelled order.
      const cancelled = await placeOrder(repos, businessId, [
        { productId: product.id, quantity: 1 },
      ]);
      await repos.orders.cancel(businessId, cancelled, "x");
      await expect(
        repos.orders.recordPayment(businessId, cancelled, { paymentMethod: "cash" }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });

    it("replaceItems recomputes the total, moves stock by the delta and refuses closed orders", async () => {
      const repos = await getRepositories();
      const products = (await repos.products.list(businessId))
        .filter((p) => p.visible && p.stock >= 10)
        .toSorted((a, b) => b.stock - a.stock);
      const [a, b] = products;
      const settings = await repos.business.getSettings(businessId);
      const fee = settings?.deliveryFee ?? 0;

      const stockA = a.stock;
      const stockB = b.stock;
      const id = await placeOrder(
        repos,
        businessId,
        [{ productId: a.id, quantity: 2 }],
        "delivery",
      );
      const placed = (await repos.orders.findById(businessId, id)) as Order;
      expect(placed.totalAmount).toBe(a.price * 2 + fee);

      // Duplicate lines are summed; the new line takes the catalog price.
      const edited = await repos.orders.replaceItems(businessId, id, [
        { productId: a.id, quantity: 1 },
        { productId: a.id, quantity: 2 },
        { productId: b.id, quantity: 1 },
      ]);
      expect(edited.items).toHaveLength(2);
      const lineA = edited.items.find((it) => it.productId === a.id)!;
      const lineB = edited.items.find((it) => it.productId === b.id)!;
      expect(lineA.quantity).toBe(3);
      expect(lineA.unitPrice).toBe(a.price);
      expect(lineB.unitPrice).toBe(b.price);
      expect(edited.totalAmount).toBe(a.price * 3 + b.price + fee);
      expect((await repos.products.findById(businessId, a.id))!.stock).toBe(stockA - 3);
      expect((await repos.products.findById(businessId, b.id))!.stock).toBe(stockB - 1);

      // Removing a line gives its stock back.
      const trimmed = await repos.orders.replaceItems(businessId, id, [
        { productId: a.id, quantity: 1 },
      ]);
      expect(trimmed.totalAmount).toBe(a.price + fee);
      expect((await repos.products.findById(businessId, b.id))!.stock).toBe(stockB);
      expect((await repos.products.findById(businessId, a.id))!.stock).toBe(stockA - 1);

      // Not enough stock: refused, nothing moves.
      await expect(
        repos.orders.replaceItems(businessId, id, [{ productId: a.id, quantity: 9999 }]),
      ).rejects.toMatchObject({ code: "STOCK_ERROR" });
      expect((await repos.products.findById(businessId, a.id))!.stock).toBe(stockA - 1);

      // Unknown product / empty list.
      await expect(
        repos.orders.replaceItems(businessId, id, [
          { productId: "00000000-0000-4000-8000-000000000099", quantity: 1 },
        ]),
      ).rejects.toThrow();
      await expect(repos.orders.replaceItems(businessId, id, [])).rejects.toThrow();

      // Closed orders refuse edits.
      const done = await orderInStatus(repos, businessId, a.id, "COMPLETED");
      await expect(
        repos.orders.replaceItems(businessId, done, [{ productId: a.id, quantity: 1 }]),
      ).rejects.toMatchObject({ code: "ORDER_STATE_CONFLICT" });
      const gone = await orderInStatus(repos, businessId, a.id, "CANCELLED");
      await expect(
        repos.orders.replaceItems(businessId, gone, [{ productId: a.id, quantity: 1 }]),
      ).rejects.toMatchObject({ code: "ORDER_STATE_CONFLICT" });
    });
  });
}
