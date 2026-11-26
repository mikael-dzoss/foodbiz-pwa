import { beforeEach, describe, expect, it } from "vitest";

import {
  LOOKUP_RATE_LIMIT_BUSINESS_MAX_REQUESTS,
  RATE_LIMIT_BUSINESS_MAX_ORDERS,
} from "@/domain/anti-abuse";
import { createMockRepositories, type MockRepositories } from "../mock";
import { DEMO_BUSINESS_ID } from "../mock/fixtures";
import { describeRepositoryContracts } from "./contracts";

describe("Mock Adapter Contract Conformance", () => {
  let mockRepos: MockRepositories;

  beforeEach(() => {
    mockRepos = createMockRepositories();
  });

  describeRepositoryContracts("In-Memory Mock Adapter", () => mockRepos, {
    nonOwnerRepositories: () => mockRepos.withRole("manager"),
  });

  it("bounds failed lookups per business like storefront_order_tracking_token", async () => {
    for (let n = 0; n < LOOKUP_RATE_LIMIT_BUSINESS_MAX_REQUESTS; n++) {
      // A different phone each time: only the business-wide ceiling can stop this.
      await mockRepos.orders.findTrackingTokenByTicketAndPhone(
        DEMO_BUSINESS_ID,
        999_000,
        `+336${String(20_000_000 + n)}`,
      );
    }
    await expect(
      mockRepos.orders.findTrackingTokenByTicketAndPhone(DEMO_BUSINESS_ID, 999_000, "+33699999999"),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("applies the per-business flood brake like place_order (RATE_LIMIT_BUSINESS_MAX_ORDERS per window)", async () => {
    const [product] = await mockRepos.products.list(DEMO_BUSINESS_ID, { visibleOnly: true });
    await mockRepos.products.update(DEMO_BUSINESS_ID, product.id, { stock: 100_000, price: 5_000 });
    const place = (n: number) =>
      mockRepos.orders.place(DEMO_BUSINESS_ID, {
        guestName: "Flood Customer",
        guestPhone: `+336${String(10_000_000 + n)}`,
        serviceType: "pickup",
        channel: "storefront",
        requestedDate: new Date().toISOString().slice(0, 10),
        items: [{ productId: product.id, quantity: 1 }],
      });

    for (let n = 0; n < RATE_LIMIT_BUSINESS_MAX_ORDERS; n++) await place(n);
    await expect(place(RATE_LIMIT_BUSINESS_MAX_ORDERS)).rejects.toMatchObject({
      code: "ANTI_ABUSE_REJECTION",
    });
  });

  it("enforces on_handover against cash OR card paymentMethods on storefront orders", async () => {
    const [product] = await mockRepos.products.list(DEMO_BUSINESS_ID, { visibleOnly: true });
    await mockRepos.products.update(DEMO_BUSINESS_ID, product.id, { stock: 20, price: 2000 });

    await mockRepos.business.updateSettings(DEMO_BUSINESS_ID, {
      paymentMethods: { cash: false, card: true, revolut: true, wero: true },
    });
    const cardHandover = await mockRepos.orders.place(DEMO_BUSINESS_ID, {
      guestName: "Card Handover",
      guestPhone: "+33691000001",
      serviceType: "pickup",
      channel: "storefront",
      requestedDate: new Date().toISOString().slice(0, 10),
      paymentPreference: "on_handover",
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect(cardHandover.orderId).toBeDefined();

    await mockRepos.business.updateSettings(DEMO_BUSINESS_ID, {
      paymentMethods: { cash: false, card: false, revolut: true, wero: true },
    });
    await expect(
      mockRepos.orders.place(DEMO_BUSINESS_ID, {
        guestName: "No Handover",
        guestPhone: "+33691000002",
        serviceType: "pickup",
        channel: "storefront",
        requestedDate: new Date().toISOString().slice(0, 10),
        paymentPreference: "on_handover",
        items: [{ productId: product.id, quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
