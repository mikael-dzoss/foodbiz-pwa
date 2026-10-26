import { describe, it, expect, beforeEach } from "vitest";
import { IdempotencyStore } from "@/lib/idempotency";
import type { PlaceOrderSuccessData } from "@/domain/checkout";

describe("IdempotencyStore", () => {
  let store: IdempotencyStore;

  const mockSuccessData: PlaceOrderSuccessData = {
    orderId: "order-123",
    orderNumber: 42,
    trackingToken: "token-abc-123",
    status: "NEW",
    totalAmount: 2500,
  };

  beforeEach(() => {
    store = new IdempotencyStore();
  });

  it("returns null when no record exists for key", () => {
    expect(store.get("biz-1", "non-existent-key")).toBeNull();
  });

  it("stores and retrieves order creation result for (businessId, key)", () => {
    store.set("biz-1", "idem-key-1", mockSuccessData);

    const retrieved = store.get("biz-1", "idem-key-1");
    expect(retrieved).toEqual(mockSuccessData);

    // Isolated per business
    expect(store.get("biz-2", "idem-key-1")).toBeNull();
  });

  it("tracks in-flight promises to coordinate concurrent double submissions", async () => {
    const promise = Promise.resolve({ success: true, data: mockSuccessData } as const);

    store.setInFlight("biz-1", "in-flight-key", promise);
    expect(store.getInFlight("biz-1", "in-flight-key")).toBe(promise);

    store.removeInFlight("biz-1", "in-flight-key");
    expect(store.getInFlight("biz-1", "in-flight-key")).toBeUndefined();
  });

  it("clears entries on reset()", () => {
    store.set("biz-1", "idem-key-1", mockSuccessData);
    store.reset();
    expect(store.get("biz-1", "idem-key-1")).toBeNull();
  });
});
