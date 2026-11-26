import type { Order } from "@/domain/order";
import { DEFAULT_TIMEZONE, getZonedDay } from "@/domain/timezone";
import { nextPhone, pickStockedProduct, placeOrder } from "./order-state.contract";
import type { Repositories } from "@/domain/repositories";
import { describe, expect, it } from "vitest";

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
      expect(found?.deliveryAddress).toBe("Private delivery address");
      expect(found).not.toHaveProperty("guestId");
      expect(found).not.toHaveProperty("submittedName");
      expect(found).not.toHaveProperty("notes");
      expect(found).not.toHaveProperty("statusHistory");
      expect(found?.items[0]).not.toHaveProperty("productId");

      // Pickup orders must never expose a deliveryAddress, even if one was stored on the row.
      const pickupPlaced = await repos.orders.place(businessId, {
        guestName: "Pickup Guest",
        guestPhone: nextPhone(),
        serviceType: "pickup",
        channel: "phone",
        requestedDate: "2030-01-01",
        items: [{ productId: product.id, quantity: 1 }],
        deliveryAddress: "Should not be returned for pickup",
      });
      const pickupFound = await repos.orders.findByTrackingToken(pickupPlaced.trackingToken);
      expect(pickupFound).not.toBeNull();
      expect(pickupFound?.deliveryAddress).toBeNull();

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
        requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
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
        requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
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
  });
}
