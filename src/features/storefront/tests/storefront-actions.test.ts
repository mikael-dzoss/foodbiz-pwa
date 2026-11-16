import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRepositories } from "@/lib/repositories";
import { getMockRepositories } from "@/lib/repositories/mock";
import { DEMO_BUSINESS_ID } from "@/lib/repositories/mock/fixtures/business";
import { getGlobalRateLimiter } from "@/lib/rate-limiter";
import { getGlobalIdempotencyStore } from "@/lib/idempotency";
import { placeOrderAction } from "../storefront-actions";

const mockRevalidateTag = vi.fn();
const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

let mockClientIp: string | null = "192.168.1.100";
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => {
      if (key.toLowerCase() === "x-forwarded-for") return mockClientIp;
      return null;
    },
  })),
}));

describe("placeOrderAction", () => {
  const bId = DEMO_BUSINESS_ID;
  const baguetteId = "33333333-3333-4333-8333-333333333301"; // price 130, stock 45
  const sourdoughId = "33333333-3333-4333-8333-333333333302"; // price 450, stock 20

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientIp = "192.168.1.100";
    getMockRepositories().reset();
    getGlobalRateLimiter().reset();
    getGlobalIdempotencyStore().reset();
  });

  const validOrderPayload = {
    businessId: bId,
    items: [
      { productId: baguetteId, quantity: 2 },
      { productId: sourdoughId, quantity: 3 },
    ],
    name: "Camille Claudel",
    phone: "+33699887766",
    serviceType: "pickup" as const,
    isAsap: true,
    paymentPreference: "on_handover" as const,
    idempotencyKey: "test-idem-key-1000",
  };

  it("places an order successfully and reserves stock atomically", async () => {
    const repos = getRepositories("mock");
    const initialBaguette = await repos.products.findById(bId, baguetteId);
    const initialSourdough = await repos.products.findById(bId, sourdoughId);

    const result = await placeOrderAction(validOrderPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("NEW");
      expect(result.data.orderNumber).toBeGreaterThan(0);
      expect(result.data.trackingToken).toBeDefined();
      // Server-side calculation: (2 * 130) + (3 * 450) = 260 + 1350 = 1610 cents
      expect(result.data.totalAmount).toBe(1610);

      // Verify stock was decremented in repository
      const updatedBaguette = await repos.products.findById(bId, baguetteId);
      const updatedSourdough = await repos.products.findById(bId, sourdoughId);
      expect(updatedBaguette?.stock).toBe((initialBaguette?.stock ?? 45) - 2);
      expect(updatedSourdough?.stock).toBe((initialSourdough?.stock ?? 20) - 3);

      // Verify order record in repo
      const createdOrder = await repos.orders.findById(bId, result.data.orderId);
      expect(createdOrder).not.toBeNull();
      expect(createdOrder?.channel).toBe("storefront");
      expect(createdOrder?.paid).toBe("unpaid");
      expect(createdOrder?.items).toHaveLength(2);
      expect(createdOrder?.statusHistory?.[0].status).toBe("NEW");
    }
  });

  it("ignores client-supplied prices and uses authoritative DB product prices", async () => {
    const result = await placeOrderAction({
      ...validOrderPayload,
      items: [
        { productId: sourdoughId, quantity: 4, price: 1 }, // 4 * 450 = 1800 (> 1500 min order)
      ],
      idempotencyKey: "test-idem-tampered-price",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // Must be DB price 1800 cents, not 4 cents
      expect(result.data.totalAmount).toBe(1800);
    }
  });

  describe("Blind Guest Find-or-Create & Zero PII Leakage", () => {
    it("returns identical response shape for new guest, returning guest, and name mismatch", async () => {
      const repos = getRepositories("mock");

      // 1. New guest
      const resNew = await placeOrderAction({
        ...validOrderPayload,
        phone: "+33611223344",
        name: "Brand New Guest",
        idempotencyKey: "idem-new-guest",
      });

      // 2. Returning guest (matches demo guest Jean Dupont with phone +33612345671)
      const resReturning = await placeOrderAction({
        ...validOrderPayload,
        phone: "+33612345671",
        name: "Jean Dupont",
        idempotencyKey: "idem-returning-guest",
      });

      // 3. Name mismatch (phone +33612345671 but differing submitted name)
      const resMismatch = await placeOrderAction({
        ...validOrderPayload,
        phone: "+33612345671",
        name: "Jean D. Secondaire",
        idempotencyKey: "idem-mismatch-guest",
      });

      expect(resNew.success).toBe(true);
      expect(resReturning.success).toBe(true);
      expect(resMismatch.success).toBe(true);

      if (resNew.success && resReturning.success && resMismatch.success) {
        // Assert identical keys in client response data
        const newKeys = Object.keys(resNew.data).sort();
        const returningKeys = Object.keys(resReturning.data).sort();
        const mismatchKeys = Object.keys(resMismatch.data).sort();

        expect(newKeys).toEqual([
          "orderId",
          "orderNumber",
          "status",
          "totalAmount",
          "trackingToken",
        ]);
        expect(returningKeys).toEqual(newKeys);
        expect(mismatchKeys).toEqual(newKeys);

        // Verify stored guest name was NOT overwritten on mismatch
        const storedGuest = await repos.guests.findByPhone(bId, "+33612345671");
        expect(storedGuest?.name).toBe("Jean Dupont");

        // Verify submittedName is set on Order for manager audit only
        const mismatchOrder = await repos.orders.findById(bId, resMismatch.data.orderId);
        expect(mismatchOrder?.submittedName).toBe("Jean D. Secondaire");

        const normalOrder = await repos.orders.findById(bId, resReturning.data.orderId);
        expect(normalOrder?.submittedName).toBeNull();
      }
    });
  });

  describe("Idempotency", () => {
    it("returns cached result without duplicating order or re-decrementing stock on double submit", async () => {
      const repos = getRepositories("mock");
      const initialBaguette = await repos.products.findById(bId, baguetteId);

      const firstCall = await placeOrderAction(validOrderPayload);
      expect(firstCall.success).toBe(true);

      const stockAfterFirst = (await repos.products.findById(bId, baguetteId))?.stock;
      expect(stockAfterFirst).toBe((initialBaguette?.stock ?? 45) - 2);

      // Replay with identical idempotencyKey
      const secondCall = await placeOrderAction(validOrderPayload);
      expect(secondCall.success).toBe(true);

      if (firstCall.success && secondCall.success) {
        expect(secondCall.data.orderId).toBe(firstCall.data.orderId);
        expect(secondCall.data.orderNumber).toBe(firstCall.data.orderNumber);
        expect(secondCall.data.trackingToken).toBe(firstCall.data.trackingToken);

        // Stock was NOT decremented a second time
        const stockAfterSecond = (await repos.products.findById(bId, baguetteId))?.stock;
        expect(stockAfterSecond).toBe(stockAfterFirst);

        // Only 1 order exists in repository
        const allOrders = await repos.orders.list(bId);
        const matchingOrders = allOrders.filter((o) => o.id === firstCall.data.orderId);
        expect(matchingOrders).toHaveLength(1);
      }
    });
  });

  describe("Anti-Abuse Protections", () => {
    it("rejects immediately when honeypot field is filled", async () => {
      const result = await placeOrderAction({
        ...validOrderPayload,
        honeypot: "I am a spam bot",
        idempotencyKey: "idem-honeypot",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("ANTI_ABUSE_REJECTION");
      }
    });

    it("rejects when an item exceeds maximum quantity per line", async () => {
      const result = await placeOrderAction({
        ...validOrderPayload,
        items: [{ productId: baguetteId, quantity: 51 }],
        idempotencyKey: "idem-max-line",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("ANTI_ABUSE_REJECTION");
        expect(result.lineErrors?.[baguetteId]).toBeDefined();
      }
    });

    it("rejects when total order items exceed maximum quantity per order", async () => {
      const result = await placeOrderAction({
        ...validOrderPayload,
        items: [
          { productId: baguetteId, quantity: 45 },
          { productId: sourdoughId, quantity: 45 },
          { productId: baguetteId, quantity: 20 },
        ],
        idempotencyKey: "idem-max-order",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("ANTI_ABUSE_REJECTION");
      }
    });

    it("enforces rate limit per IP address", async () => {
      mockClientIp = "203.0.113.195";

      for (let i = 0; i < 5; i++) {
        const res = await placeOrderAction({
          ...validOrderPayload,
          phone: `+3360000000${i}`, // Distinct phones to isolate IP rate limit
          idempotencyKey: `idem-ip-limit-${i}`,
        });
        expect(res.success).toBe(true);
      }

      // 6th attempt from same IP must be rate limited
      const blocked = await placeOrderAction({
        ...validOrderPayload,
        phone: "+33600000009",
        idempotencyKey: "idem-ip-limit-blocked",
      });

      expect(blocked.success).toBe(false);
      if (!blocked.success) {
        expect(blocked.code).toBe("ANTI_ABUSE_REJECTION");
        expect(blocked.error).toContain("Too many order attempts");
      }
    });

    it("enforces rate limit per phone number", async () => {
      const targetPhone = "+33655443322";

      for (let i = 0; i < 3; i++) {
        mockClientIp = `192.168.10.${i + 1}`; // Vary IP to isolate phone limit
        const res = await placeOrderAction({
          ...validOrderPayload,
          phone: targetPhone,
          idempotencyKey: `idem-phone-limit-${i}`,
        });
        expect(res.success).toBe(true);
      }

      // 4th attempt for same phone must be rate limited
      mockClientIp = "192.168.10.99";
      const blocked = await placeOrderAction({
        ...validOrderPayload,
        phone: targetPhone,
        idempotencyKey: "idem-phone-limit-blocked",
      });

      expect(blocked.success).toBe(false);
      if (!blocked.success) {
        expect(blocked.code).toBe("ANTI_ABUSE_REJECTION");
        expect(blocked.error).toContain("Too many order attempts");
      }
    });
  });

  describe("Business Settings & Stock Validation", () => {
    it("rejects order when product stock is insufficient and returns typed lineErrors", async () => {
      const result = await placeOrderAction({
        ...validOrderPayload,
        items: [{ productId: sourdoughId, quantity: 25 }], // sourdough only has 20 in stock (25 * 450 > 1500)
        idempotencyKey: "idem-insufficient-stock",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("STOCK_ERROR");
        expect(result.lineErrors?.[sourdoughId]).toContain("Insufficient stock");
      }
    });

    it("rejects order when subtotal is below minimum order amount", async () => {
      const repos = getRepositories("mock");
      // Set minOrderAmount to 5000 cents (€50.00)
      await repos.business.updateSettings(bId, { minOrderAmount: 5000 });

      const result = await placeOrderAction({
        ...validOrderPayload,
        items: [{ productId: baguetteId, quantity: 1 }], // 130 cents
        idempotencyKey: "idem-under-min-order",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("MINIMUM_ORDER_UNMET");
      }
    });

    it("rejects order when store is not accepting orders", async () => {
      const repos = getRepositories("mock");
      await repos.business.updateSettings(bId, { acceptingOrders: false });

      const result = await placeOrderAction({
        ...validOrderPayload,
        idempotencyKey: "idem-store-closed",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("STORE_CLOSED");
      }
    });

    it("rejects order when requested service type is disabled in settings", async () => {
      const repos = getRepositories("mock");
      await repos.business.updateSettings(bId, {
        serviceTypes: { pickup: false, delivery: true, dineIn: true },
      });

      const result = await placeOrderAction({
        ...validOrderPayload,
        serviceType: "pickup",
        idempotencyKey: "idem-disabled-pickup",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("SERVICE_TYPE_DISABLED");
      }
    });
  });

  describe("Stock integrity & retry safety", () => {
    it("merges duplicate product lines before validating stock", async () => {
      const repos = getRepositories("mock");
      const before = (await repos.products.findById(bId, sourdoughId))!.stock;

      const result = await placeOrderAction({
        ...validOrderPayload,
        items: [
          { productId: sourdoughId, quantity: before - 4 },
          { productId: sourdoughId, quantity: 5 }, // each line fits alone, the sum does not
        ],
        idempotencyKey: "idem-duplicate-lines-oversell",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("STOCK_ERROR");
        expect(result.lineErrors?.[sourdoughId]).toContain("Insufficient stock");
      }
      expect((await repos.products.findById(bId, sourdoughId))?.stock).toBe(before);
    });

    it("decrements stock once per summed quantity and creates a single order line", async () => {
      const repos = getRepositories("mock");
      const before = (await repos.products.findById(bId, sourdoughId))!.stock;

      const result = await placeOrderAction({
        ...validOrderPayload,
        items: [
          { productId: sourdoughId, quantity: 2 },
          { productId: sourdoughId, quantity: 2 },
        ],
        idempotencyKey: "idem-duplicate-lines-ok",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalAmount).toBe(4 * 450);
        const order = await repos.orders.findById(bId, result.data.orderId);
        expect(order?.items).toHaveLength(1);
        expect(order?.items[0].quantity).toBe(4);
      }
      expect((await repos.products.findById(bId, sourdoughId))?.stock).toBe(before - 4);
    });

    it("releases reserved stock when order creation fails and allows a clean retry", async () => {
      const repos = getRepositories("mock");
      const before = (await repos.products.findById(bId, baguetteId))!.stock;
      vi.spyOn(repos.orders, "place").mockRejectedValueOnce(new Error("db down"));

      const failed = await placeOrderAction({
        ...validOrderPayload,
        idempotencyKey: "idem-create-failure",
      });

      expect(failed.success).toBe(false);
      if (!failed.success) {
        expect(failed.code).toBe("INTERNAL_ERROR");
        expect(failed.error).not.toContain("db down");
      }
      expect((await repos.products.findById(bId, baguetteId))?.stock).toBe(before);

      const retry = await placeOrderAction({
        ...validOrderPayload,
        idempotencyKey: "idem-create-failure",
      });
      expect(retry.success).toBe(true);
      expect((await repos.products.findById(bId, baguetteId))?.stock).toBe(before - 2);
    });

    it("maps OrderRepoError from orders.place to typed action failure", async () => {
      const repos = getRepositories("mock");
      const { OrderRepoError } = await import("@/domain");
      vi.spyOn(repos.orders, "place").mockRejectedValueOnce(
        new OrderRepoError("Insufficient stock", "STOCK_ERROR"),
      );
      const res = await placeOrderAction(validOrderPayload);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.code).toBe("STOCK_ERROR");
        expect(res.error).toBe("Insufficient stock");
      }
    });

    it("does not consume rate-limit budget on idempotent replays", async () => {
      mockClientIp = "198.51.100.7";
      const first = await placeOrderAction({ ...validOrderPayload, idempotencyKey: "idem-replay" });
      expect(first.success).toBe(true);

      for (let i = 0; i < 10; i++) {
        const replay = await placeOrderAction({
          ...validOrderPayload,
          idempotencyKey: "idem-replay",
        });
        expect(replay).toEqual(first);
      }
    });

    it("does not pool requests without a client IP into one shared rate-limit bucket", async () => {
      mockClientIp = null;

      for (let i = 0; i < 6; i++) {
        const res = await placeOrderAction({
          ...validOrderPayload,
          items: [
            { productId: baguetteId, quantity: 3 },
            { productId: sourdoughId, quantity: 3 }, // 390 + 1350 cents (> min order)
          ],
          phone: `+3360000010${i}`,
          idempotencyKey: `idem-no-ip-${i}`,
        });
        expect(res.success).toBe(true);
      }
    });
  });
});
