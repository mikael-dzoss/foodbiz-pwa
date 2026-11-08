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
      const product = (await repos.products.list(businessId))[0];
      const guest = (await repos.guests.list(businessId))[0];
      const input = {
        guestId: guest.id,
        serviceType: "pickup" as const,
        channel: "storefront" as const,
        status: "COMPLETED" as const,
        paid: "paid" as const,
        paymentPreference: "on_handover" as const,
        requestedDate: "2030-01-01",
        items: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 2,
            unitPrice: product.price,
            totalPrice: product.price * 2,
          },
        ],
        totalAmount: product.price * 2,
      };
      const first = await repos.orders.create(businessId, input);
      await repos.orders.create(businessId, input);
      await repos.orders.create(businessId, { ...input, status: "CANCELLED" });
      await repos.orders.create(businessId, { ...input, paid: "refunded" });
      await repos.orders.create(businessId, { ...input, status: "NEW" });
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

    it("create adds a new order with auto orderNumber and timestamps", async () => {
      const repos = await getRepositories();
      const product = (await repos.products.list(businessId))[0];
      const guest = (await repos.guests.list(businessId))[0];

      const created = await repos.orders.create(businessId, {
        guestId: guest.id,
        serviceType: "pickup",
        channel: "storefront",
        status: "NEW",
        paid: "unpaid",
        paymentPreference: "on_handover",
        requestedDate: "2026-10-15",
        items: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 2,
            unitPrice: product.price,
            totalPrice: product.price * 2,
          },
        ],
        totalAmount: product.price * 2,
      });

      expect(created.id).toBeDefined();
      expect(created.orderNumber).toBeGreaterThan(0);
      expect(created.status).toBe("NEW");
      expect(created.totalAmount).toBe(product.price * 2);
      expect(created.trackingToken).toBeDefined();

      const found = await repos.orders.findById(businessId, created.id);
      expect(found).not.toBeNull();
      expect(found?.guestId).toBe(guest.id);
    });

    it("update modifies order fields and updates updatedAt", async () => {
      const repos = await getRepositories();
      const existing = (await repos.orders.list(businessId))[0];

      const updated = await repos.orders.update(businessId, existing.id, {
        status: "CANCELLED",
        cancellationReason: "Customer request",
      });

      expect(updated.status).toBe("CANCELLED");
      expect(updated.cancellationReason).toBe("Customer request");

      const fetched = await repos.orders.findById(businessId, existing.id);
      expect(fetched?.status).toBe("CANCELLED");
    });

    it("findByTrackingToken returns order by token or null", async () => {
      const repos = await getRepositories();
      const product = (await repos.products.list(businessId))[0];
      const guest = (await repos.guests.list(businessId))[0];
      const created = await repos.orders.create(businessId, {
        guestId: guest.id,
        serviceType: "pickup",
        channel: "storefront",
        status: "NEW",
        paid: "unpaid",
        paymentPreference: "on_handover",
        requestedDate: "2026-10-15",
        items: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitPrice: product.price,
            totalPrice: product.price,
          },
        ],
        totalAmount: product.price,
        submittedName: "Private submitted name",
        deliveryAddress: "Private delivery address",
        notes: "Private door code",
        statusHistory: [
          { status: "NEW", timestamp: "2026-10-15T12:00:00.000Z", note: "Internal note" },
        ],
      });

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

    it("findByTicketAndPhone validates ticket n° against guest phone", async () => {
      const repos = await getRepositories();
      const guests = await repos.guests.list(businessId);
      const guestWithPhone = guests.find((g) => Boolean(g.phone));
      expect(guestWithPhone).toBeDefined();

      const orders = await repos.orders.list(businessId, { guestId: guestWithPhone!.id });
      expect(orders.length).toBeGreaterThan(0);
      const targetOrder = orders[0];
      expect(targetOrder.orderNumber).toBeDefined();

      // Successful lookup
      const found = await repos.orders.findByTicketAndPhone(
        businessId,
        targetOrder.orderNumber!,
        guestWithPhone!.phone!,
      );
      expect(found).not.toBeNull();
      expect(found?.orderNumber).toBe(targetOrder.orderNumber);
      expect(found).not.toHaveProperty("guestId");
      expect(found).not.toHaveProperty("submittedName");
      expect(found).not.toHaveProperty("deliveryAddress");

      // Wrong phone number fails
      const wrongPhone = await repos.orders.findByTicketAndPhone(
        businessId,
        targetOrder.orderNumber!,
        "+33699999999",
      );
      expect(wrongPhone).toBeNull();

      // Wrong ticket number fails
      const wrongTicket = await repos.orders.findByTicketAndPhone(
        businessId,
        999999,
        guestWithPhone!.phone!,
      );
      expect(wrongTicket).toBeNull();
    });

    it("update throws when order does not exist", async () => {
      const repos = await getRepositories();
      await expect(
        repos.orders.update(businessId, "00000000-0000-4000-8000-000000000099", {
          status: "READY",
        }),
      ).rejects.toThrow();
    });
  });
}
