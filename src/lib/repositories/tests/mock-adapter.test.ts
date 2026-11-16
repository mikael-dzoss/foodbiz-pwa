import { beforeEach, describe, expect, it } from "vitest";

import { RATE_LIMIT_BUSINESS_MAX_ORDERS } from "@/domain/anti-abuse";
import { createMockRepositories, type MockRepositories } from "../mock";
import { DEMO_BUSINESS_ID } from "../mock/fixtures";
import { describeRepositoryContracts } from "./contracts";

describe("Mock Adapter Contract Conformance", () => {
  let mockRepos: MockRepositories;

  beforeEach(() => {
    mockRepos = createMockRepositories();
  });

  describeRepositoryContracts("In-Memory Mock Adapter", () => mockRepos);

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
});
