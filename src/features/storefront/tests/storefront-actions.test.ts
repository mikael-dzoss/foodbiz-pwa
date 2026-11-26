import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRepositories } from "@/lib/repositories";
import { getMockRepositories } from "@/lib/repositories/mock";
import { DEMO_BUSINESS_ID, DEMO_PRODUCT, demoGuests } from "@/lib/repositories/mock/fixtures";
import { getGlobalRateLimiter } from "@/lib/rate-limiter";
import { OrderRepoError } from "@/domain/order";
import type { WeeklyHours } from "@/domain/opening-hours";
import { addCalendarDays, DEFAULT_TIMEZONE, getZonedDay } from "@/domain/timezone";
import { placeOrderAction } from "../storefront-actions";

const mockUpdateTag = vi.fn();
const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  updateTag: (...args: unknown[]) => mockUpdateTag(...args),
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

/** Stable uuid per label: the idempotency key is a uuid (stored on orders.idempotency_key). */
const idempotencyKeys = new Map<string, string>();
function idem(label: string): string {
  const existing = idempotencyKeys.get(label);
  if (existing) return existing;
  const key = `f0000000-0000-4000-8000-${String(idempotencyKeys.size + 1).padStart(12, "0")}`;
  idempotencyKeys.set(label, key);
  return key;
}

describe("placeOrderAction", () => {
  const bId = DEMO_BUSINESS_ID;
  const firstProduct = DEMO_PRODUCT.beignetsSouffles; // price 1000, stock 30
  const secondProduct = DEMO_PRODUCT.pouletBraise; // price 1500, stock 20
  const firstProductId = firstProduct.id;
  const secondProductId = secondProduct.id;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockClientIp = "192.168.1.100";
    getMockRepositories().reset();
    getGlobalRateLimiter().reset();
    // The demo store has opening hours: clear them so these tests never depend on the time of
    // day (the "opening-hours rules" block sets hours relative to now).
    await getMockRepositories().business.updateSettings(bId, {
      weeklyHours: null,
      hoursExceptions: [],
    });
  });

  const validOrderPayload = {
    items: [
      { productId: firstProductId, quantity: 2 },
      { productId: secondProductId, quantity: 3 },
    ],
    name: "Camille Claudel",
    phone: "+33699887766",
    serviceType: "pickup" as const,
    isAsap: true,
    paymentPreference: "on_handover" as const,
    idempotencyKey: idem("test-idem-key-1000"),
  };

  it("refreshes the storefront catalog and manager pages only for a new order", async () => {
    await placeOrderAction(validOrderPayload);
    expect(mockUpdateTag).toHaveBeenCalledWith("storefront-catalog");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/orders");

    mockUpdateTag.mockClear();
    await placeOrderAction(validOrderPayload); // same idempotency key: replay
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("places an order successfully and reserves stock atomically", async () => {
    const repos = getRepositories("mock");
    const initialFirst = await repos.products.findById(bId, firstProductId);
    const initialSecond = await repos.products.findById(bId, secondProductId);

    const result = await placeOrderAction(validOrderPayload);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("NEW");
      expect(result.data.orderNumber).toBeGreaterThan(0);
      expect(result.data.trackingToken).toBeDefined();
      expect(result.data.totalAmount).toBe(2 * firstProduct.price + 3 * secondProduct.price);

      // Verify stock was decremented in repository
      const updatedFirst = await repos.products.findById(bId, firstProductId);
      const updatedSecond = await repos.products.findById(bId, secondProductId);
      expect(updatedFirst?.stock).toBe((initialFirst?.stock ?? firstProduct.stock) - 2);
      expect(updatedSecond?.stock).toBe((initialSecond?.stock ?? secondProduct.stock) - 3);

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
      items: [{ productId: secondProductId, quantity: 4, price: 1 }],
      idempotencyKey: idem("test-idem-tampered-price"),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalAmount).toBe(4 * secondProduct.price);
    }
  });

  describe("Blind Guest Find-or-Create & Zero PII Leakage", () => {
    it("returns identical response shape for new guest, returning guest, and name mismatch", async () => {
      const repos = getRepositories("mock");
      const returningGuest = demoGuests[0];
      const returningPhone = returningGuest.phone!;

      // 1. New guest
      const resNew = await placeOrderAction({
        ...validOrderPayload,
        phone: "+33611223344",
        name: "Brand New Guest",
        idempotencyKey: idem("idem-new-guest"),
      });

      // 2. Returning guest (matches demo guest)
      const resReturning = await placeOrderAction({
        ...validOrderPayload,
        phone: returningPhone,
        name: returningGuest.name,
        idempotencyKey: idem("idem-returning-guest"),
      });

      // 3. Name mismatch (returning phone but differing submitted name)
      const resMismatch = await placeOrderAction({
        ...validOrderPayload,
        phone: returningPhone,
        name: "Aïcha M. Secondaire",
        idempotencyKey: idem("idem-mismatch-guest"),
      });

      expect(resNew.ok).toBe(true);
      expect(resReturning.ok).toBe(true);
      expect(resMismatch.ok).toBe(true);

      if (resNew.ok && resReturning.ok && resMismatch.ok) {
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
        const storedGuest = await repos.guests.findByPhone(bId, returningPhone);
        expect(storedGuest?.name).toBe(returningGuest.name);

        // Verify submittedName is set on Order for manager audit only
        const mismatchOrder = await repos.orders.findById(bId, resMismatch.data.orderId);
        expect(mismatchOrder?.submittedName).toBe("Aïcha M. Secondaire");

        const normalOrder = await repos.orders.findById(bId, resReturning.data.orderId);
        expect(normalOrder?.submittedName).toBeNull();
      }
    });
  });

  describe("Idempotency", () => {
    it("returns cached result without duplicating order or re-decrementing stock on double submit", async () => {
      const repos = getRepositories("mock");
      const initialFirst = await repos.products.findById(bId, firstProductId);

      const firstCall = await placeOrderAction(validOrderPayload);
      expect(firstCall.ok).toBe(true);

      const stockAfterFirst = (await repos.products.findById(bId, firstProductId))?.stock;
      expect(stockAfterFirst).toBe((initialFirst?.stock ?? firstProduct.stock) - 2);

      // Replay with identical idempotencyKey
      const secondCall = await placeOrderAction(validOrderPayload);
      expect(secondCall.ok).toBe(true);

      if (firstCall.ok && secondCall.ok) {
        expect(secondCall.data.orderId).toBe(firstCall.data.orderId);
        expect(secondCall.data.orderNumber).toBe(firstCall.data.orderNumber);
        expect(secondCall.data.trackingToken).toBe(firstCall.data.trackingToken);

        // Stock was NOT decremented a second time
        const stockAfterSecond = (await repos.products.findById(bId, firstProductId))?.stock;
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
        idempotencyKey: idem("idem-honeypot"),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("ANTI_ABUSE_REJECTION");
      }
    });

    it("rejects when an item exceeds maximum quantity per line", async () => {
      const result = await placeOrderAction({
        ...validOrderPayload,
        items: [{ productId: firstProductId, quantity: 51 }],
        idempotencyKey: idem("idem-max-line"),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("ANTI_ABUSE_REJECTION");
        expect(result.lineErrors?.[firstProductId]).toBeDefined();
      }
    });

    it("rejects when total order items exceed maximum quantity per order", async () => {
      const result = await placeOrderAction({
        ...validOrderPayload,
        items: [
          { productId: firstProductId, quantity: 45 },
          { productId: secondProductId, quantity: 45 },
          { productId: firstProductId, quantity: 20 },
        ],
        idempotencyKey: idem("idem-max-order"),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("ANTI_ABUSE_REJECTION");
      }
    });

    it("enforces rate limit per IP address", async () => {
      mockClientIp = "203.0.113.195";

      for (let i = 0; i < 5; i++) {
        const res = await placeOrderAction({
          ...validOrderPayload,
          phone: `+3360000000${i}`, // Distinct phones to isolate IP rate limit
          idempotencyKey: idem(`idem-ip-limit-${i}`),
        });
        expect(res.ok).toBe(true);
      }

      // 6th attempt from same IP must be rate limited
      const blocked = await placeOrderAction({
        ...validOrderPayload,
        phone: "+33600000009",
        idempotencyKey: idem("idem-ip-limit-blocked"),
      });

      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.reason).toBe("ANTI_ABUSE_REJECTION");
        expect(blocked.message).toContain("Too many order attempts");
      }
    });

    it("enforces rate limit per phone number", async () => {
      const targetPhone = "+33655443322";

      for (let i = 0; i < 3; i++) {
        mockClientIp = `192.168.10.${i + 1}`; // Vary IP to isolate phone limit
        const res = await placeOrderAction({
          ...validOrderPayload,
          phone: targetPhone,
          idempotencyKey: idem(`idem-phone-limit-${i}`),
        });
        expect(res.ok).toBe(true);
      }

      // 4th attempt for same phone must be rate limited
      mockClientIp = "192.168.10.99";
      const blocked = await placeOrderAction({
        ...validOrderPayload,
        phone: targetPhone,
        idempotencyKey: idem("idem-phone-limit-blocked"),
      });

      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.reason).toBe("ANTI_ABUSE_REJECTION");
        expect(blocked.message).toContain("Too many order attempts");
      }
    });
  });

  describe("Business Settings & Stock Validation", () => {
    it("rejects order when product stock is insufficient and returns typed lineErrors", async () => {
      const result = await placeOrderAction({
        ...validOrderPayload,
        items: [{ productId: secondProductId, quantity: secondProduct.stock + 5 }],
        idempotencyKey: idem("idem-insufficient-stock"),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("STOCK_ERROR");
        expect(result.lineErrors?.[secondProductId]).toContain("Insufficient stock");
      }
    });

    it("rejects order when subtotal is below minimum order amount", async () => {
      const repos = getRepositories("mock");
      // Set minOrderAmount to 5000 cents (€50.00)
      await repos.business.updateSettings(bId, { minOrderAmount: 5000 });

      const result = await placeOrderAction({
        ...validOrderPayload,
        items: [{ productId: firstProductId, quantity: 1 }],
        idempotencyKey: idem("idem-under-min-order"),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("MINIMUM_ORDER_UNMET");
      }
    });

    it("rejects order when store is not accepting orders", async () => {
      const repos = getRepositories("mock");
      await repos.business.updateSettings(bId, { acceptingOrders: false });

      const result = await placeOrderAction({
        ...validOrderPayload,
        idempotencyKey: idem("idem-store-closed"),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("STORE_CLOSED");
      }
    });

    describe("opening-hours rules (hours set relative to now)", () => {
      const week = (ranges: { open: string; close: string }[]): WeeklyHours => ({
        mon: ranges,
        tue: ranges,
        wed: ranges,
        thu: ranges,
        fri: ranges,
        sat: ranges,
        sun: ranges,
      });
      const closedAllWeek = week([]);
      const openAllWeek = week([{ open: "00:00", close: "24:00" }]);
      const businessToday = async () =>
        getZonedDay(
          new Date(),
          (await getMockRepositories().business.getSettings(bId))?.timezone ?? DEFAULT_TIMEZONE,
        );

      it("refuses an ASAP order while closed, without touching stock", async () => {
        const repos = getRepositories("mock");
        await repos.business.updateSettings(bId, { weeklyHours: closedAllWeek });
        const before = (await repos.products.findById(bId, firstProductId))?.stock;
        const place = vi.spyOn(repos.orders, "place");

        const result = await placeOrderAction({
          ...validOrderPayload,
          idempotencyKey: idem("idem-asap-closed"),
        });

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe("SLOT_CLOSED_NOW");
        expect((await repos.products.findById(bId, firstProductId))?.stock).toBe(before);
        place.mockRestore();
      });

      it("accepts an ASAP order while open", async () => {
        const repos = getRepositories("mock");
        await repos.business.updateSettings(bId, { weeklyHours: openAllWeek });
        const result = await placeOrderAction({
          ...validOrderPayload,
          idempotencyKey: idem("idem-asap-open"),
        });
        expect(result.ok).toBe(true);
      });

      it("refuses a scheduled order on a closed day and outside the 30-day window", async () => {
        const repos = getRepositories("mock");
        await repos.business.updateSettings(bId, { weeklyHours: closedAllWeek });
        const today = await businessToday();

        const closedDay = await placeOrderAction({
          ...validOrderPayload,
          isAsap: false,
          requestedDate: addCalendarDays(today, 1),
          idempotencyKey: idem("idem-closed-day"),
        });
        expect(closedDay.ok).toBe(false);
        if (!closedDay.ok) expect(closedDay.reason).toBe("SLOT_CLOSED_DAY");

        const tooFar = await placeOrderAction({
          ...validOrderPayload,
          isAsap: false,
          requestedDate: addCalendarDays(today, 31),
          idempotencyKey: idem("idem-too-far"),
        });
        expect(tooFar.ok).toBe(false);
        if (!tooFar.ok) expect(tooFar.reason).toBe("SLOT_DATE_OUT_OF_WINDOW");
      });

      it("keeps the accepting-orders refusal when orders are switched off", async () => {
        const repos = getRepositories("mock");
        await repos.business.updateSettings(bId, {
          acceptingOrders: false,
          weeklyHours: openAllWeek,
        });
        const result = await placeOrderAction({
          ...validOrderPayload,
          idempotencyKey: idem("idem-accepting-off"),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe("STORE_CLOSED");
      });
    });

    it("rejects order when requested service type is disabled in settings", async () => {
      const repos = getRepositories("mock");
      await repos.business.updateSettings(bId, {
        serviceTypes: { pickup: false, delivery: true, dineIn: true },
      });

      const result = await placeOrderAction({
        ...validOrderPayload,
        serviceType: "pickup",
        idempotencyKey: idem("idem-disabled-pickup"),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("SERVICE_TYPE_DISABLED");
      }
    });
  });

  describe("Stock integrity & retry safety", () => {
    it("merges duplicate product lines before validating stock", async () => {
      const repos = getRepositories("mock");
      const before = (await repos.products.findById(bId, secondProductId))!.stock;

      const result = await placeOrderAction({
        ...validOrderPayload,
        items: [
          { productId: secondProductId, quantity: before - 4 },
          { productId: secondProductId, quantity: 5 }, // each line fits alone, the sum does not
        ],
        idempotencyKey: idem("idem-duplicate-lines-oversell"),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("STOCK_ERROR");
        expect(result.lineErrors?.[secondProductId]).toContain("Insufficient stock");
      }
      expect((await repos.products.findById(bId, secondProductId))?.stock).toBe(before);
    });

    it("decrements stock once per summed quantity and creates a single order line", async () => {
      const repos = getRepositories("mock");
      const before = (await repos.products.findById(bId, secondProductId))!.stock;

      const result = await placeOrderAction({
        ...validOrderPayload,
        items: [
          { productId: secondProductId, quantity: 2 },
          { productId: secondProductId, quantity: 2 },
        ],
        idempotencyKey: idem("idem-duplicate-lines-ok"),
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.totalAmount).toBe(4 * secondProduct.price);
        const order = await repos.orders.findById(bId, result.data.orderId);
        expect(order?.items).toHaveLength(1);
        expect(order?.items[0].quantity).toBe(4);
      }
      expect((await repos.products.findById(bId, secondProductId))?.stock).toBe(before - 4);
    });

    it("releases reserved stock when order creation fails and allows a clean retry", async () => {
      const repos = getRepositories("mock");
      const before = (await repos.products.findById(bId, firstProductId))!.stock;
      vi.spyOn(repos.orders, "place").mockRejectedValueOnce(new Error("db down"));

      const failed = await placeOrderAction({
        ...validOrderPayload,
        idempotencyKey: idem("idem-create-failure"),
      });

      expect(failed.ok).toBe(false);
      if (!failed.ok) {
        expect(failed.code).toBe("INTERNAL");
        expect(failed.message).not.toContain("db down");
      }
      expect((await repos.products.findById(bId, firstProductId))?.stock).toBe(before);

      const retry = await placeOrderAction({
        ...validOrderPayload,
        idempotencyKey: idem("idem-create-failure"),
      });
      expect(retry.ok).toBe(true);
      expect((await repos.products.findById(bId, firstProductId))?.stock).toBe(before - 2);
    });

    it("maps OrderRepoError from orders.place to typed action failure", async () => {
      const repos = getRepositories("mock");
      const { OrderRepoError } = await import("@/domain");
      vi.spyOn(repos.orders, "place").mockRejectedValueOnce(
        new OrderRepoError("Insufficient stock", "STOCK_ERROR"),
      );
      const res = await placeOrderAction(validOrderPayload);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("STOCK_ERROR");
        expect(res.message).toBe("Insufficient stock");
      }
    });

    it("replays a retry of the order that took the last units instead of reporting out of stock", async () => {
      const payload = {
        ...validOrderPayload,
        items: [{ productId: secondProductId, quantity: secondProduct.stock }], // all remaining units
        idempotencyKey: idem("idem-last-units"),
      };
      const first = await placeOrderAction(payload);
      expect(first.ok).toBe(true);

      const retry = await placeOrderAction(payload);
      expect(retry).toEqual(first);

      // A different key for the same (now unavailable) items still fails as out of stock.
      const other = await placeOrderAction({ ...payload, idempotencyKey: idem("idem-other-key") });
      expect(other).toMatchObject({ ok: false, reason: "STOCK_ERROR" });
    });

    it("does not consume rate-limit budget on idempotent replays", async () => {
      mockClientIp = "198.51.100.7";
      const first = await placeOrderAction({
        ...validOrderPayload,
        idempotencyKey: idem("idem-replay"),
      });
      expect(first.ok).toBe(true);

      for (let i = 0; i < 10; i++) {
        const replay = await placeOrderAction({
          ...validOrderPayload,
          idempotencyKey: idem("idem-replay"),
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
            { productId: firstProductId, quantity: 3 },
            { productId: secondProductId, quantity: 3 },
          ],
          phone: `+3360000010${i}`,
          idempotencyKey: idem(`idem-no-ip-${i}`),
        });
        expect(res.ok).toBe(true);
      }
    });
  });
});

describe("placeOrderAction failure handling", () => {
  const payload = {
    items: [{ productId: DEMO_PRODUCT.beignetsSouffles.id, quantity: 2 }],
    name: "Camille Claudel",
    phone: "+33699887766",
    serviceType: "pickup" as const,
    isAsap: true,
    paymentPreference: "on_handover" as const,
    idempotencyKey: idem("test-idem-key-failure"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getMockRepositories().reset();
    getGlobalRateLimiter().reset();
  });

  it("returns a generic typed error instead of throwing when the settings read fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(getMockRepositories().business, "getSettings").mockRejectedValue(
      new Error('permission denied for table "business_settings" (42501)'),
    );

    const result = await placeOrderAction(payload);

    expect(result).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Something went wrong. Please try again.",
    });
    expect(JSON.stringify(result)).not.toContain("42501");
    expect(errorSpy).toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("33699887766");
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("returns a generic typed error when the product read fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(getMockRepositories().products, "list").mockRejectedValue(new Error("db down"));

    const result = await placeOrderAction({
      ...payload,
      idempotencyKey: idem("test-idem-key-fail-2"),
    });

    expect(result).toMatchObject({ ok: false, code: "INTERNAL" });
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("maps repository input errors to VALIDATION_ERROR and hides unknown failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const orders = getMockRepositories().orders;
    vi.spyOn(orders, "place").mockRejectedValueOnce(new OrderRepoError("bad", "INVALID_INPUT"));
    expect(
      await placeOrderAction({ ...payload, idempotencyKey: idem("test-idem-key-input") }),
    ).toMatchObject({ ok: false, code: "VALIDATION" });

    vi.spyOn(orders, "place").mockRejectedValueOnce(new Error("relation x exploded"));
    const result = await placeOrderAction({
      ...payload,
      idempotencyKey: idem("test-idem-key-boom"),
    });
    expect(result).toMatchObject({ ok: false, code: "INTERNAL" });
    expect(JSON.stringify(result)).not.toContain("exploded");
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });
});

describe("placeOrderAction business resolution", () => {
  it("ignores a forged businessId: zod strips the unknown key and the configured business is used", async () => {
    getMockRepositories().reset();
    getGlobalRateLimiter().reset();
    const placeSpy = vi.spyOn(getMockRepositories().orders, "place");
    const result = await placeOrderAction({
      businessId: "99999999-9999-4999-8999-999999999999",
      items: [{ productId: DEMO_PRODUCT.boulettes.id, quantity: 2 }],
      name: "Camille Claudel",
      phone: "+33699887766",
      serviceType: "pickup",
      isAsap: true,
      paymentPreference: "on_handover",
      idempotencyKey: idem("test-idem-key-forged-biz"),
    });
    expect(result.ok).toBe(true);
    expect(placeSpy).toHaveBeenCalledWith(DEMO_BUSINESS_ID, expect.anything());
    placeSpy.mockRestore();
  });
});

describe("placeOrderAction pickup locations (#386)", () => {
  const bId = DEMO_BUSINESS_ID;
  const payload = {
    items: [{ productId: DEMO_PRODUCT.beignetsSouffles.id, quantity: 2 }], // 2 x 1000
    name: "Camille Claudel",
    phone: "+33699887766",
    serviceType: "pickup" as const,
    isAsap: true,
    paymentPreference: "on_handover" as const,
  };
  const allDay = [{ open: "00:00", close: "24:00" }];
  const week = (override: Partial<WeeklyHours> = {}): WeeklyHours => ({
    mon: allDay,
    tue: allDay,
    wed: allDay,
    thu: allDay,
    fri: allDay,
    sat: allDay,
    sun: allDay,
    ...override,
  });

  const addRelay = async (
    extra: { feeCents?: number; weeklyHours?: WeeklyHours | null; isActive?: boolean } = {},
  ) =>
    getMockRepositories().pickupLocations.create(bId, {
      name: "Gare du Nord",
      address: "18 Rue de Dunkerque",
      postcode: "75010",
      feeCents: 150,
      ...extra,
    });

  beforeEach(async () => {
    vi.clearAllMocks();
    getMockRepositories().reset();
    getGlobalRateLimiter().reset();
    await getMockRepositories().business.updateSettings(bId, {
      weeklyHours: null,
      hoursExceptions: [],
    });
  });

  it("stores the relay and its fee on the order and in the total", async () => {
    const relay = await addRelay();
    const result = await placeOrderAction({
      ...payload,
      pickupLocationId: relay.id,
      idempotencyKey: idem("pl-relay"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalAmount).toBe(2150);
    const order = await getMockRepositories().orders.findById(bId, result.data.orderId);
    expect(order?.pickupFeeCents).toBe(150);
    expect(order?.pickupLocation).toEqual({
      id: relay.id,
      name: "Gare du Nord",
      address: "18 Rue de Dunkerque, 75010",
    });
  });

  it("treats a missing location as the shop while shop pickup is on", async () => {
    await addRelay();
    const result = await placeOrderAction({ ...payload, idempotencyKey: idem("pl-shop") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalAmount).toBe(2000);
    const order = await getMockRepositories().orders.findById(bId, result.data.orderId);
    expect(order?.pickupLocation).toBeNull();
  });

  it("refuses an unknown or inactive location", async () => {
    const inactive = await addRelay({ isActive: false });
    for (const pickupLocationId of [crypto.randomUUID(), inactive.id]) {
      const result = await placeOrderAction({
        ...payload,
        pickupLocationId,
        idempotencyKey: idem(`pl-invalid-${pickupLocationId}`),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("PICKUP_LOCATION_INVALID");
    }
  });

  it("refuses a pickup location on a delivery order", async () => {
    const relay = await addRelay();
    const result = await placeOrderAction({
      ...payload,
      serviceType: "delivery",
      deliveryAddress: "12 Rue de Rivoli, 75001 Paris",
      pickupLocationId: relay.id,
      idempotencyKey: idem("pl-delivery"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION");
  });

  it("requires a choice when several relays are offered without shop pickup", async () => {
    const first = await addRelay();
    await addRelay();
    await getMockRepositories().business.updateSettings(bId, { shopPickupEnabled: false });

    const missing = await placeOrderAction({ ...payload, idempotencyKey: idem("pl-required") });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe("PICKUP_LOCATION_REQUIRED");

    const chosen = await placeOrderAction({
      ...payload,
      pickupLocationId: first.id,
      idempotencyKey: idem("pl-chosen"),
    });
    expect(chosen.ok).toBe(true);
  });

  it("selects a lone relay automatically when shop pickup is off", async () => {
    const relay = await addRelay();
    await getMockRepositories().business.updateSettings(bId, { shopPickupEnabled: false });
    const result = await placeOrderAction({ ...payload, idempotencyKey: idem("pl-auto") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await getMockRepositories().orders.findById(bId, result.data.orderId);
    expect(order?.pickupLocation?.id).toBe(relay.id);
    expect(result.data.totalAmount).toBe(2150);
  });

  it("validates the slot against the relay hours and the business closed days", async () => {
    const settings = await getMockRepositories().business.getSettings(bId);
    const today = getZonedDay(new Date(), settings?.timezone ?? DEFAULT_TIMEZONE);
    const tomorrow = addCalendarDays(today, 1);
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const tomorrowKey = days[new Date(`${tomorrow}T12:00:00Z`).getUTCDay()];
    const scheduled = { ...payload, isAsap: false, requestedDate: tomorrow };

    // The relay is closed tomorrow; the shop is open: only the relay refuses.
    const closedRelay = await addRelay({ weeklyHours: week({ [tomorrowKey]: [] }) });
    await getMockRepositories().business.updateSettings(bId, { weeklyHours: week() });
    const refused = await placeOrderAction({
      ...scheduled,
      pickupLocationId: closedRelay.id,
      idempotencyKey: idem("pl-slot-relay"),
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe("SLOT_CLOSED_DAY");
    expect(
      (await placeOrderAction({ ...scheduled, idempotencyKey: idem("pl-slot-shop") })).ok,
    ).toBe(true);

    // The business is closed tomorrow: a relay open that day stays closed.
    const openRelay = await addRelay({ weeklyHours: week() });
    await getMockRepositories().business.updateSettings(bId, {
      weeklyHours: week({ [tomorrowKey]: [] }),
    });
    const businessClosed = await placeOrderAction({
      ...scheduled,
      pickupLocationId: openRelay.id,
      idempotencyKey: idem("pl-slot-business"),
    });
    expect(businessClosed.ok).toBe(false);
    if (!businessClosed.ok) expect(businessClosed.reason).toBe("SLOT_CLOSED_DAY");
  });

  it("refuses with PICKUP_NOT_AVAILABLE when shop pickup is off and no active relay exists", async () => {
    await getMockRepositories().business.updateSettings(bId, { shopPickupEnabled: false });
    const result = await placeOrderAction({
      ...payload,
      idempotencyKey: idem("pl-no-option"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("PICKUP_NOT_AVAILABLE");
  });

  it("keeps the minimum order check on items subtotal without counting the relay fee", async () => {
    const relay = await addRelay({ feeCents: 300 });
    await getMockRepositories().business.updateSettings(bId, { minOrderAmount: 2100 });
    const result = await placeOrderAction({
      ...payload, // 2 x 1000 = 2000 < 2100 (even though 2000 + 300 = 2300)
      pickupLocationId: relay.id,
      idempotencyKey: idem("pl-min-order"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MINIMUM_ORDER_UNMET");
  });

  it("rejects an ASAP order at a closed relay while the shop is open, and honours relay hours on auto-select", async () => {
    const closedAllWeek = week({
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    });
    const relay = await addRelay({ weeklyHours: closedAllWeek });
    await getMockRepositories().business.updateSettings(bId, { weeklyHours: week() });

    const explicit = await placeOrderAction({
      ...payload,
      pickupLocationId: relay.id,
      idempotencyKey: idem("pl-asap-closed-relay"),
    });
    expect(explicit.ok).toBe(false);
    if (!explicit.ok) expect(explicit.reason).toBe("SLOT_CLOSED_NOW");

    // Auto-selected lone relay also enforces the relay's hours.
    await getMockRepositories().business.updateSettings(bId, { shopPickupEnabled: false });
    const auto = await placeOrderAction({
      ...payload,
      idempotencyKey: idem("pl-asap-auto-closed-relay"),
    });
    expect(auto.ok).toBe(false);
    if (!auto.ok) expect(auto.reason).toBe("SLOT_CLOSED_NOW");
  });

  it("applies business closure exceptions to a relay and ignores business special-hours exceptions", async () => {
    const settings = await getMockRepositories().business.getSettings(bId);
    const today = getZonedDay(new Date(), settings?.timezone ?? DEFAULT_TIMEZONE);
    const tomorrow = addCalendarDays(today, 1);
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const tomorrowKey = days[new Date(`${tomorrow}T12:00:00Z`).getUTCDay()];
    const scheduled = { ...payload, isAsap: false, requestedDate: tomorrow };

    // Business closure exception overrides an open relay.
    const openRelay = await addRelay({ weeklyHours: week() });
    await getMockRepositories().business.updateSettings(bId, {
      weeklyHours: week(),
      hoursExceptions: [{ from: tomorrow, to: tomorrow, ranges: [] }],
    });
    const closedEx = await placeOrderAction({
      ...scheduled,
      pickupLocationId: openRelay.id,
      idempotencyKey: idem("pl-ex-closed"),
    });
    expect(closedEx.ok).toBe(false);
    if (!closedEx.ok) expect(closedEx.reason).toBe("SLOT_CLOSED_DAY");

    // Business special-hours exception does NOT open a relay on its closed weekday.
    const closedTomorrowRelay = await addRelay({ weeklyHours: week({ [tomorrowKey]: [] }) });
    await getMockRepositories().business.updateSettings(bId, {
      weeklyHours: week(),
      hoursExceptions: [{ from: tomorrow, to: tomorrow, ranges: allDay }],
    });
    const specialEx = await placeOrderAction({
      ...scheduled,
      pickupLocationId: closedTomorrowRelay.id,
      idempotencyKey: idem("pl-ex-special"),
    });
    expect(specialEx.ok).toBe(false);
    if (!specialEx.ok) expect(specialEx.reason).toBe("SLOT_CLOSED_DAY");
  });
});
