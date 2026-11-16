import { ALLOWED_ORDER_TRANSITIONS } from "@/domain/order-lifecycle";
import { orderStatusSchema, type Order, type OrderStatus } from "@/domain/order";
import type { Repositories } from "@/domain/repositories";
import { describe, expect, it } from "vitest";

let phoneCounter = 0;
function nextPhone(): string {
  phoneCounter += 1;
  return `+3361100${String(phoneCounter).padStart(4, "0")}`;
}

/** The product with the most stock: every helper below reserves a few units. */
async function pickStockedProduct(repos: Repositories, businessId: string) {
  const products = await repos.products.list(businessId);
  return products.filter((p) => p.visible).toSorted((a, b) => b.stock - a.stock)[0];
}

/** Places a manager-channel order (works on mock and live) and returns its id. */
async function placeOrder(
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
async function orderInStatus(
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

export function describeOrderRepositoryContract(
  getRepositories: () => Promise<Repositories> | Repositories,
  businessId: string,
): void {
  describe("OrderRepository contract", () => {
    it("list returns orders with status, guestId and date range filters", async () => {
      const repos = await getRepositories();
      const all = await repos.orders.list(businessId);
      expect(all.length).toBeGreaterThan(0);

      const completed = await repos.orders.list(businessId, { status: "COMPLETED" });
      expect(completed.length).toBeGreaterThan(0);
      expect(completed.every((o) => o.status === "COMPLETED")).toBe(true);

      const withGuest = all.find((o) => Boolean(o.guestId));
      if (withGuest && withGuest.guestId) {
        const guestOrders = await repos.orders.list(businessId, { guestId: withGuest.guestId });
        expect(guestOrders.length).toBeGreaterThan(0);
        expect(guestOrders.every((o) => o.guestId === withGuest.guestId)).toBe(true);
      }

      const dateFiltered = await repos.orders.list(businessId, {
        fromDate: "2026-09-01",
        toDate: "2026-09-30",
      });
      expect(
        dateFiltered.every(
          (o) => o.requestedDate >= "2026-09-01" && o.requestedDate <= "2026-09-30",
        ),
      ).toBe(true);
    });

    it("sumQuantitiesByProduct returns tenant-scoped aggregates without private order/guest data", async () => {
      const repos = await getRepositories();
      const product = await pickStockedProduct(repos, businessId);
      const make = async (steps: "completed" | "cancelled" | "refunded" | "new") => {
        const id = await placeOrder(repos, businessId, [{ productId: product.id, quantity: 2 }]);
        if (steps === "new") return id;
        if (steps === "cancelled") {
          await repos.orders.cancel(businessId, id, "contract");
          return id;
        }
        for (const [expectedStatus, nextStatus] of [
          ["NEW", "CONFIRMED"],
          ["CONFIRMED", "PREPARING"],
          ["PREPARING", "READY"],
        ] as const) {
          await repos.orders.transition(businessId, id, { expectedStatus, nextStatus });
        }
        await repos.orders.recordPayment(businessId, id, {
          paymentMethod: "cash",
          markCompleted: true,
        });
        if (steps === "refunded") await repos.orders.recordRefund(businessId, id, "contract");
        return id;
      };
      const firstId = await make("completed");
      const first = (await repos.orders.findById(businessId, firstId))!;
      await make("completed");
      await make("cancelled");
      await make("refunded");
      await make("new");
      const filter = {
        fromDate: first.createdAt,
        toDate: new Date().toISOString(),
        excludeStatuses: ["NEW" as const],
      };
      const totals = await repos.orders.sumQuantitiesByProduct(businessId, filter);
      const total = totals.find((row) => row.productId === product.id);
      expect(total).toEqual({
        productId: product.id,
        quantity: 4,
        lastOrderedAt: expect.any(String),
      });
      expect(
        totals.every(
          (row) => Object.keys(row).toSorted().join(",") === "lastOrderedAt,productId,quantity",
        ),
      ).toBe(true);
      expect(
        await repos.orders.sumQuantitiesByProduct("00000000-0000-4000-8000-000000000099", filter),
      ).toEqual([]);
      expect(
        await repos.orders.sumQuantitiesByProduct(businessId, {
          ...filter,
          fromDate: "1999-01-01T00:00:00.000Z",
          toDate: "1999-01-02T00:00:00.000Z",
        }),
      ).toEqual([]);
      total!.quantity = 999;
      expect(
        (await repos.orders.sumQuantitiesByProduct(businessId, filter)).find(
          (row) => row.productId === product.id,
        )?.quantity,
      ).toBe(4);
    });

    it("findById returns order or null", async () => {
      const repos = await getRepositories();
      const first = (await repos.orders.list(businessId))[0];
      const found = await repos.orders.findById(businessId, first.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(first.id);

      const notFound = await repos.orders.findById(
        businessId,
        "00000000-0000-4000-8000-000000000099",
      );
      expect(notFound).toBeNull();
    });

    it("findByTrackingToken returns order by token or null", async () => {
      const repos = await getRepositories();
      const product = await pickStockedProduct(repos, businessId);
      const placed = await repos.orders.place(businessId, {
        guestName: "Private Guest",
        guestPhone: nextPhone(),
        serviceType: "delivery",
        channel: "phone",
        requestedDate: "2030-01-01",
        items: [{ productId: product.id, quantity: 1 }],
        deliveryAddress: "Private delivery address",
        notes: "Private door code",
      });
      const created = (await repos.orders.findById(businessId, placed.orderId)) as Order;

      expect(created.trackingToken).toBeDefined();
      const found = await repos.orders.findByTrackingToken(created.trackingToken!);
      expect(found).not.toBeNull();
      expect(found?.orderNumber).toBe(created.orderNumber);
      expect(created.trackingToken).toMatch(/^[a-f0-9]{32}$/);
      expect(found).not.toHaveProperty("guestId");
      expect(found).not.toHaveProperty("submittedName");
      expect(found).not.toHaveProperty("deliveryAddress");
      expect(found).not.toHaveProperty("notes");
      expect(found).not.toHaveProperty("statusHistory");
      expect(found?.items[0]).not.toHaveProperty("productId");

      const notFound = await repos.orders.findByTrackingToken("non-existent-token");
      expect(notFound).toBeNull();
    });

    it("findTrackingTokenByTicketAndPhone returns only the token on an exact match (#230)", async () => {
      const repos = await getRepositories();
      const guests = await repos.guests.list(businessId);
      const guest = guests.find((g) => Boolean(g.phone))!;
      const [order] = await repos.orders.list(businessId, { guestId: guest.id });

      await expect(
        repos.orders.findTrackingTokenByTicketAndPhone(
          businessId,
          order.orderNumber!,
          guest.phone!,
        ),
      ).resolves.toBe(order.trackingToken);
      await expect(
        repos.orders.findTrackingTokenByTicketAndPhone(
          businessId,
          order.orderNumber!,
          "+33699999999",
        ),
      ).resolves.toBeNull();
      await expect(
        repos.orders.findTrackingTokenByTicketAndPhone(businessId, 999999, guest.phone!),
      ).resolves.toBeNull();
    });

    it("place atomically validates stock, resolves guest, and places the order", async () => {
      const repos = await getRepositories();
      const product = (await repos.products.list(businessId)).find(
        (p) => p.visible && p.stock >= 10 && p.price >= 300,
      )!;
      const initialStock = product.stock;
      const quantity = Math.max(1, Math.ceil(1500 / product.price));

      const placed = await repos.orders.place(businessId, {
        guestName: "Contract Customer",
        guestPhone: "+33611223344",
        serviceType: "pickup",
        channel: "storefront",
        requestedDate: "2026-12-01",
        items: [{ productId: product.id, quantity }],
      });

      expect(placed.orderId).toBeDefined();
      expect(placed.orderNumber).toBeGreaterThan(0);
      expect(placed.trackingToken).toBeDefined();
      expect(placed.totalAmount).toBe(product.price * quantity);

      const updatedProduct = await repos.products.findById(businessId, product.id);
      expect(updatedProduct?.stock).toBe(initialStock - quantity);

      const fetchedOrder = await repos.orders.findById(businessId, placed.orderId);
      expect(fetchedOrder).not.toBeNull();
      expect(fetchedOrder?.status).toBe("NEW");
    });

    it("cancel atomically cancels an order and restores product stock", async () => {
      const repos = await getRepositories();
      const product = (await repos.products.list(businessId)).find(
        (p) => p.visible && p.stock >= 10 && p.price >= 300,
      )!;
      const quantity = Math.max(1, Math.ceil(1500 / product.price));

      const placed = await repos.orders.place(businessId, {
        guestName: "Cancel Contract Customer",
        guestPhone: "+33611223355",
        serviceType: "pickup",
        channel: "storefront",
        requestedDate: "2026-12-01",
        items: [{ productId: product.id, quantity }],
      });

      const stockAfterPlace = (await repos.products.findById(businessId, product.id))?.stock ?? 0;

      const cancelResult = await repos.orders.cancel(
        businessId,
        placed.orderId,
        "Customer request",
      );
      expect(cancelResult.orderId).toBe(placed.orderId);
      expect(cancelResult.status).toBe("CANCELLED");
      expect(cancelResult.cancellationReason).toBe("Customer request");

      const stockAfterCancel = (await repos.products.findById(businessId, product.id))?.stock ?? 0;
      expect(stockAfterCancel).toBe(stockAfterPlace + quantity);

      const fetchedOrder = await repos.orders.findById(businessId, placed.orderId);
      expect(fetchedOrder?.status).toBe("CANCELLED");
    });

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
