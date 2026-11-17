import { describe, expect, it, vi, beforeEach } from "vitest";
import { findOrCreateGuest, type Order, type Product, type Guest, OrderRepoError } from "@/domain";
import { getOrder } from "../order-data";
import {
  listOrdersAction,
  createManualOrderAction,
  progressOrderStatusAction,
  recordPaymentAction,
  markOrderUnpaidAction,
  markPaidAndCompleteAction,
  recordRefundAction,
  lookupGuestByPhoneAction,
} from "../order-actions";

const mockRevalidatePath = vi.fn();
const mockUpdateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) =>
    type ? mockRevalidatePath(path, type) : mockRevalidatePath(path),
  updateTag: (tag: string) => mockUpdateTag(tag),
}));

const testBusinessId = "11111111-1111-4111-8111-111111111111";
const validGuestId = "55555555-5555-4555-8555-555555555501";
const secondGuestId = "55555555-5555-4555-8555-555555555502";
const validProductId = "33333333-3333-4333-8333-333333333301";
const validOrderId = "66666666-6666-4666-8666-666666666601";
const completedOrderId = "66666666-6666-4666-8666-666666666602";
const cancelledOrderId = "66666666-6666-4666-8666-666666666603";

let mockOrders: Order[] = [];
let mockGuests: Guest[] = [];
let mockProducts: Product[] = [];

const mockOrderRepo = {
  list: vi.fn(async () => [...mockOrders]),
  findById: vi.fn(async (_bId: string, id: string) => mockOrders.find((o) => o.id === id) ?? null),
  place: vi.fn(
    async (
      bId: string,
      input: {
        guestName: string;
        guestPhone: string;
        serviceType: Order["serviceType"];
        channel: Order["channel"];
        requestedDate: string;
        requestedTime?: string | null;
        items: Array<{ productId: string; quantity: number }>;
        paymentPreference?: Order["paymentPreference"];
        deliveryAddress?: string | null;
        notes?: string | null;
        allowRename?: boolean;
      },
    ) => {
      // 1. Stock check & decrement
      for (const item of input.items) {
        const prod = mockProducts.find((p) => p.id === item.productId);
        if (!prod || prod.stock < item.quantity) {
          throw new Error("Insufficient stock");
        }
      }
      for (const item of input.items) {
        const prod = mockProducts.find((p) => p.id === item.productId)!;
        prod.stock -= item.quantity;
      }

      // 2. Guest resolution
      const guestRes = findOrCreateGuest(
        mockGuests,
        {
          businessId: bId,
          name: input.guestName,
          phone: input.guestPhone,
          address: input.deliveryAddress,
        },
        { allowRename: input.allowRename },
      );

      // 3. Totals
      const orderItems = input.items.map((it) => {
        const p = mockProducts.find((pr) => pr.id === it.productId)!;
        return {
          id: crypto.randomUUID(),
          productId: p.id,
          productName: p.name,
          quantity: it.quantity,
          unitPrice: p.price,
          totalPrice: p.price * it.quantity,
        };
      });
      const totalAmount = orderItems.reduce((acc, it) => acc + it.totalPrice, 0);

      const o: Order = {
        id: crypto.randomUUID(),
        businessId: bId,
        orderNumber: mockOrders.length + 1,
        guestId: guestRes.guestId,
        submittedName: guestRes.nameMismatch ? input.guestName : null,
        serviceType: input.serviceType,
        channel: input.channel,
        status: "NEW",
        paid: "unpaid",
        paymentPreference: input.paymentPreference ?? "on_handover",
        requestedDate: input.requestedDate,
        requestedTime: input.requestedTime ?? null,
        items: orderItems,
        totalAmount,
        trackingToken: "track123",
        notes: input.notes ?? null,
        deliveryAddress: input.deliveryAddress ?? null,
        statusHistory: [{ status: "NEW", timestamp: new Date().toISOString(), note: null }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockOrders.push(o);
      return {
        orderId: o.id,
        orderNumber: o.orderNumber!,
        trackingToken: o.trackingToken!,
        submittedName: o.submittedName,
        totalAmount: o.totalAmount,
      };
    },
  ),
  cancel: vi.fn(async (_bId: string, orderId: string, reason?: string | null) => {
    const o = mockOrders.find((ord) => ord.id === orderId);
    if (!o) throw new Error("Order not found");
    for (const it of o.items) {
      const prod = mockProducts.find((p) => p.id === it.productId);
      if (prod) prod.stock += it.quantity;
    }
    o.status = "CANCELLED";
    o.cancellationReason = reason ?? o.cancellationReason;
    o.updatedAt = new Date().toISOString();
    return {
      orderId: o.id,
      status: "CANCELLED" as const,
      cancellationReason: o.cancellationReason,
    };
  }),
  // Atomic in the database (transition_order_status): expected-status check, restock on cancel,
  // history entry. Reduced here to what the action tests observe.
  transition: vi.fn(
    async (
      _bId: string,
      orderId: string,
      input: {
        expectedStatus: Order["status"];
        nextStatus: Order["status"];
        reason?: string | null;
      },
    ) => {
      const o = mockOrders.find((ord) => ord.id === orderId);
      if (!o) throw new OrderRepoError("Order not found", "ORDER_NOT_FOUND");
      if (o.status !== input.expectedStatus) {
        throw new OrderRepoError("The order changed, please reload.", "ORDER_STATE_CONFLICT");
      }
      if (input.nextStatus === "CANCELLED") {
        for (const it of o.items) {
          const prod = mockProducts.find((p) => p.id === it.productId);
          if (prod) prod.stock += it.quantity;
        }
        o.cancellationReason = input.reason ?? o.cancellationReason;
      }
      o.status = input.nextStatus;
      o.statusHistory = [
        ...(o.statusHistory ?? []),
        {
          status: input.nextStatus,
          timestamp: new Date().toISOString(),
          note: input.reason ?? null,
        },
      ];
      return structuredClone(o);
    },
  ),
  recordPayment: vi.fn(
    async (
      _bId: string,
      orderId: string,
      input: { paymentMethod: "cash" | "revolut" | "wero"; markCompleted?: boolean },
    ) => {
      const o = mockOrders.find((ord) => ord.id === orderId);
      if (!o) throw new OrderRepoError("Order not found", "ORDER_NOT_FOUND");
      o.paid = "paid";
      o.paymentMethod = input.paymentMethod;
      o.paidAt = new Date().toISOString();
      if (input.markCompleted) {
        o.status = "COMPLETED";
        o.statusHistory = [
          ...(o.statusHistory ?? []),
          {
            status: "COMPLETED",
            timestamp: new Date().toISOString(),
            note: `Paid via ${input.paymentMethod} and completed`,
          },
        ];
      }
      return structuredClone(o);
    },
  ),
  markUnpaid: vi.fn(async (_bId: string, orderId: string) => {
    const o = mockOrders.find((ord) => ord.id === orderId);
    if (!o) throw new OrderRepoError("Order not found", "ORDER_NOT_FOUND");
    o.paid = "unpaid";
    o.paymentMethod = null;
    o.paidAt = null;
    o.statusHistory = [
      ...(o.statusHistory ?? []),
      {
        status: o.status,
        timestamp: new Date().toISOString(),
        note: "Payment marked as unpaid (undone)",
      },
    ];
    return structuredClone(o);
  }),
  recordRefund: vi.fn(async (_bId: string, orderId: string, reason?: string | null) => {
    const o = mockOrders.find((ord) => ord.id === orderId);
    if (!o) throw new OrderRepoError("Order not found", "ORDER_NOT_FOUND");
    o.paid = "refunded";
    o.refundedAt = new Date().toISOString();
    o.statusHistory = [
      ...(o.statusHistory ?? []),
      {
        status: o.status,
        timestamp: new Date().toISOString(),
        note: reason ? `Refund recorded: ${reason}` : "Refund recorded",
      },
    ];
    return structuredClone(o);
  }),
};

const mockGuestRepo = {
  list: vi.fn(async () => [...mockGuests]),
  findById: vi.fn(async (_bId: string, id: string) => mockGuests.find((g) => g.id === id) ?? null),
  findByPhone: vi.fn(
    async (_bId: string, phone: string) => mockGuests.find((g) => g.phone === phone) ?? null,
  ),
  create: vi.fn(
    async (
      bId: string,
      input: { name: string; phone?: string | null; address?: string | null },
    ) => {
      const g: Guest = {
        id: "55555555-5555-4555-8555-555555555599",
        businessId: bId,
        name: input.name,
        phone: input.phone ?? null,
        email: null,
        address: input.address ?? null,
        notes: null,
        createdAt: new Date().toISOString(),
      };
      mockGuests.push(g);
      return structuredClone(g);
    },
  ),
};

const mockProductRepo = {
  list: vi.fn(async () => [...mockProducts]),
  findById: vi.fn(
    async (_bId: string, id: string) => mockProducts.find((p) => p.id === id) ?? null,
  ),
  update: vi.fn(async (_bId: string, id: string, input: { stock?: number }) => {
    const idx = mockProducts.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Product not found");
    const updated = { ...mockProducts[idx], ...input, updatedAt: new Date().toISOString() };
    mockProducts[idx] = updated;
    return structuredClone(updated);
  }),
};

let mockTimezone = "UTC";

vi.mock("@/lib/repositories", () => ({
  getRepositories: () => ({
    orders: mockOrderRepo,
    guests: mockGuestRepo,
    products: mockProductRepo,
    business: { getSettings: vi.fn(async () => ({ timezone: mockTimezone })) },
  }),
}));

const mockRequireAuthenticatedAction = vi.fn(async () => ({
  session: {
    user: { id: "user-1", email: "manager@test.com" },
    business: { id: testBusinessId, name: "Test Biz", slug: "test-biz" },
    role: "manager" as const,
  },
  businessId: testBusinessId,
}));

const authState = vi.hoisted(() => ({ role: "owner" as "owner" | "manager" | "staff" }));

vi.mock("@/features/auth", async () => {
  const domainAuth = await vi.importActual<typeof import("@/domain/auth")>("@/domain/auth");
  return {
    requireAuthenticatedAction: () => mockRequireAuthenticatedAction(),
    requireOwnerAction: async () => {
      const context = await mockRequireAuthenticatedAction();
      if (authState.role !== "owner") throw new domainAuth.OwnerRequiredError();
      return context;
    },
  };
});

describe("Order Server Actions", () => {
  beforeEach(() => {
    authState.role = "owner";
    vi.clearAllMocks();

    mockGuests = [
      {
        id: validGuestId,
        businessId: testBusinessId,
        name: "Jean Dupont",
        phone: "+33612345678",
        email: "jean@example.com",
        address: "10 Rue de la Paix",
        notes: null,
        createdAt: "2026-10-01T10:00:00.000Z",
      },
      {
        id: secondGuestId,
        businessId: testBusinessId,
        name: "Sophie Martin",
        phone: "+33698765432",
        email: "sophie@example.com",
        address: "55 Avenue Foch",
        notes: null,
        createdAt: "2026-10-01T10:00:00.000Z",
      },
    ];

    mockProducts = [
      {
        id: validProductId,
        businessId: testBusinessId,
        categoryId: "cat-1",
        name: "Burger Maison",
        description: null,
        price: 850,
        unitCost: 300,
        stock: 10,
        visible: true,
        allergens: [],
        suggestAddOns: true,
        imageUrl: null,
        createdAt: "2026-10-01T10:00:00.000Z",
        updatedAt: "2026-10-01T10:00:00.000Z",
      },
    ];

    mockOrders = [
      {
        id: validOrderId,
        businessId: testBusinessId,
        orderNumber: 42,
        guestId: validGuestId,
        serviceType: "pickup",
        channel: "phone",
        status: "CONFIRMED",
        paid: "unpaid",
        paymentPreference: "on_handover",
        paymentMethod: null,
        paidAt: null,
        requestedDate: "2026-10-13",
        requestedTime: null, // ASAP
        items: [
          {
            id: "item-1",
            productId: validProductId,
            productName: "Burger Maison",
            quantity: 2,
            unitPrice: 850,
            totalPrice: 1700,
          },
        ],
        totalAmount: 1700,
        trackingToken: "token42",
        cancellationReason: null,
        notes: "Extra cheese",
        deliveryAddress: null,
        statusHistory: [
          { status: "CONFIRMED", timestamp: "2026-10-13T12:00:00.000Z", note: "Created" },
        ],
        createdAt: "2026-10-13T12:00:00.000Z",
        updatedAt: "2026-10-13T12:00:00.000Z",
      },
      {
        id: completedOrderId,
        businessId: testBusinessId,
        orderNumber: 41,
        guestId: secondGuestId,
        serviceType: "delivery",
        channel: "storefront",
        status: "COMPLETED",
        paid: "paid",
        paymentPreference: "revolut",
        paymentMethod: "revolut",
        paidAt: "2026-10-13T11:00:00.000Z",
        requestedDate: "2026-10-13",
        requestedTime: "11:30",
        items: [
          {
            id: "item-2",
            productId: validProductId,
            productName: "Burger Maison",
            quantity: 1,
            unitPrice: 850,
            totalPrice: 850,
          },
        ],
        totalAmount: 850,
        trackingToken: "token41",
        cancellationReason: null,
        notes: null,
        deliveryAddress: "55 Avenue Foch",
        statusHistory: [
          { status: "NEW", timestamp: "2026-10-13T10:00:00.000Z", note: null },
          { status: "COMPLETED", timestamp: "2026-10-13T11:30:00.000Z", note: null },
        ],
        createdAt: "2026-10-13T10:00:00.000Z",
        updatedAt: "2026-10-13T11:30:00.000Z",
      },
      {
        id: cancelledOrderId,
        businessId: testBusinessId,
        orderNumber: 40,
        guestId: validGuestId,
        serviceType: "pickup",
        channel: "in-person",
        status: "CANCELLED",
        paid: "unpaid",
        paymentPreference: "on_handover",
        paymentMethod: null,
        paidAt: null,
        requestedDate: "2026-10-12",
        requestedTime: "19:00",
        items: [
          {
            id: "item-3",
            productId: validProductId,
            productName: "Burger Maison",
            quantity: 1,
            unitPrice: 850,
            totalPrice: 850,
          },
        ],
        totalAmount: 850,
        trackingToken: "token40",
        cancellationReason: "Customer changed mind",
        notes: null,
        deliveryAddress: null,
        statusHistory: [
          { status: "CONFIRMED", timestamp: "2026-10-12T18:00:00.000Z", note: null },
          {
            status: "CANCELLED",
            timestamp: "2026-10-12T18:30:00.000Z",
            note: "Customer changed mind",
          },
        ],
        createdAt: "2026-10-12T18:00:00.000Z",
        updatedAt: "2026-10-12T18:30:00.000Z",
      },
    ];
  });

  describe("listOrdersAction", () => {
    it("returns active orders by default with accurate global counts", async () => {
      const res = await listOrdersAction();
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.orders).toHaveLength(1);
        expect(res.data.orders[0].id).toBe(validOrderId);
        expect(res.data.counts.active).toBe(1);
        expect(res.data.counts.completed).toBe(1);
        expect(res.data.counts.cancelled).toBe(1);
        expect(res.data.counts.total).toBe(3);
        expect(res.data.counts.unpaid).toBe(2);
      }
    });

    it("filters orders by completed statusTab", async () => {
      const res = await listOrdersAction({ statusTab: "completed" });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.orders).toHaveLength(1);
        expect(res.data.orders[0].id).toBe(completedOrderId);
      }
    });

    it("filters orders by cancelled statusTab", async () => {
      const res = await listOrdersAction({ statusTab: "cancelled" });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.orders).toHaveLength(1);
        expect(res.data.orders[0].id).toBe(cancelledOrderId);
      }
    });

    it("filters orders by unpaidOnly", async () => {
      const res = await listOrdersAction({ statusTab: "all", unpaidOnly: true });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.orders).toHaveLength(2);
        expect(res.data.orders.every((o) => o.paid === "unpaid")).toBe(true);
      }
    });

    it("filters orders by serviceType", async () => {
      const res = await listOrdersAction({ statusTab: "all", serviceType: "delivery" });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.orders).toHaveLength(1);
        expect(res.data.orders[0].serviceType).toBe("delivery");
      }
    });

    it("searches orders by order number, guest name, or phone", async () => {
      // Order number search
      const resNum = await listOrdersAction({ statusTab: "all", search: "42" });
      expect(resNum.ok).toBe(true);
      if (resNum.ok) expect(resNum.data.orders).toHaveLength(1);

      // Name search
      const resName = await listOrdersAction({ statusTab: "all", search: "Sophie" });
      expect(resName.ok).toBe(true);
      if (resName.ok) expect(resName.data.orders[0].guestName).toBe("Sophie Martin");

      // Phone search
      const resPhone = await listOrdersAction({ statusTab: "all", search: "12345678" });
      expect(resPhone.ok).toBe(true);
      if (resPhone.ok) expect(resPhone.data.orders[0].guestName).toBe("Jean Dupont");
    });

    it("sorts orders with ASAP before scheduled times", async () => {
      // Add another active order with scheduled time on the same date
      mockOrders.push({
        id: "order-scheduled",
        businessId: testBusinessId,
        orderNumber: 43,
        guestId: validGuestId,
        serviceType: "pickup",
        channel: "phone",
        status: "CONFIRMED",
        paid: "paid",
        paymentPreference: "on_handover",
        requestedDate: "2026-10-13",
        requestedTime: "14:00",
        items: [],
        totalAmount: 1000,
        createdAt: "2026-10-13T12:30:00.000Z",
        updatedAt: "2026-10-13T12:30:00.000Z",
      });

      const res = await listOrdersAction({ statusTab: "active" });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.orders).toHaveLength(2);
        // Order #42 has requestedTime: null (ASAP), should come first!
        expect(res.data.orders[0].id).toBe(validOrderId);
        expect(res.data.orders[1].id).toBe("order-scheduled");
      }
    });

    it("rejects invalid filter input", async () => {
      const res = await listOrdersAction({ statusTab: "invalid" as unknown as "active" });
      expect(res).toMatchObject({ ok: false, code: "VALIDATION" });
    });
  });

  describe("getOrder (data module)", () => {
    it("returns order with enriched guest phone and address", async () => {
      const res = await getOrder(validOrderId);
      expect(res?.order.guestName).toBe("Jean Dupont");
      expect(res?.order.guestPhone).toBe("+33612345678");
      expect(res?.guest).not.toBeNull();
    });

    it("returns null for an invalid or unknown order ID", async () => {
      expect(await getOrder("not-a-uuid")).toBeNull();
      expect(await getOrder("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("throws on repository failure instead of returning null", async () => {
      mockOrderRepo.findById.mockRejectedValueOnce(new Error("Offline"));
      await expect(getOrder(validOrderId)).rejects.toThrow("Offline");
    });
  });

  describe("createManualOrderAction", () => {
    it("rejects invalid input schema with field errors", async () => {
      const res = await createManualOrderAction({
        guestPhone: "",
        guestName: "",
        items: [],
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.fieldErrors).toBeDefined();
      }
    });

    it("defaults an ASAP order to today on the business calendar, not the server's UTC day", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-14T23:30:00Z")); // 15 Oct 01:30 in Paris
      mockTimezone = "Europe/Paris";
      const place = vi.spyOn(mockOrderRepo, "place");
      try {
        const res = await createManualOrderAction({
          guestPhone: "+33612345678",
          guestName: "Jean Dupont",
          serviceType: "pickup",
          channel: "phone",
          isAsap: true,
          items: [{ productId: validProductId, quantity: 1 }],
        });
        expect(res.ok).toBe(true);
        expect(place).toHaveBeenCalledWith(
          testBusinessId,
          expect.objectContaining({ requestedDate: "2026-10-15" }),
        );
      } finally {
        vi.useRealTimers();
        mockTimezone = "UTC";
      }
    });

    it("rejects order when product stock is insufficient", async () => {
      const res = await createManualOrderAction({
        guestPhone: "+33612345678",
        guestName: "Jean Dupont",
        serviceType: "pickup",
        channel: "phone",
        isAsap: true,
        items: [
          {
            productId: validProductId,
            quantity: 50, // Available is 10
          },
        ],
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("Insufficient stock");
      }
    });

    it("returns error when repos.orders.place rejects", async () => {
      vi.spyOn(mockOrderRepo, "place").mockRejectedValueOnce(new Error("RPC failed"));
      const res = await createManualOrderAction({
        guestPhone: "+33612345678",
        guestName: "Jean Dupont",
        serviceType: "pickup",
        channel: "phone",
        isAsap: true,
        items: [{ productId: validProductId, quantity: 1 }],
      });
      expect(res).toMatchObject({ ok: false, code: "INTERNAL" });
      expect(JSON.stringify(res)).not.toContain("RPC failed");
    });

    it("creates order as CONFIRMED, reuses existing guest, and decrements stock", async () => {
      const initialStock = mockProducts[0].stock;
      const res = await createManualOrderAction({
        guestPhone: "+33612345678",
        guestName: "Jean Dupont",
        serviceType: "pickup",
        channel: "phone",
        isAsap: true,
        items: [
          {
            productId: validProductId,
            quantity: 3,
          },
        ],
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.status).toBe("CONFIRMED");
        expect(res.data.guestId).toBe(validGuestId);
        expect(res.data.items[0].quantity).toBe(3);
        expect(res.data.totalAmount).toBe(2550); // 3 * 850
        // Product stock decremented
        expect(mockProducts[0].stock).toBe(initialStock - 3);
        // Status history recorded
        // place_order starts the history (NEW); the manual order appends CONFIRMED instead of overwriting it.
        expect(res.data.statusHistory?.map((e) => e.status)).toEqual(["NEW", "CONFIRMED"]);
        expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/orders");
      }
    });

    it("creates new guest when phone does not match existing guest", async () => {
      const res = await createManualOrderAction({
        guestPhone: "+33699887766",
        guestName: "Nouveau Client",
        deliveryAddress: "88 Rue Neuve",
        serviceType: "delivery",
        channel: "whatsapp",
        isAsap: false,
        requestedDate: "2026-10-14",
        requestedTime: "18:00",
        items: [
          {
            productId: validProductId,
            quantity: 1,
          },
        ],
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.deliveryAddress).toBe("88 Rue Neuve");
        const createdGuest = mockGuests.find((g) => g.phone === "+33699887766");
        expect(createdGuest).toBeDefined();
        expect(createdGuest?.name).toBe("Nouveau Client");
        expect(res.data.guestId).toBe(createdGuest?.id);
      }
    });

    it("preserves canonical guest name and records submittedName on mismatch when updateGuestName is false", async () => {
      const res = await createManualOrderAction({
        guestPhone: "06 12 34 56 78",
        guestName: "Jean-Paul Dupont",
        updateGuestName: false,
        serviceType: "pickup",
        channel: "phone",
        isAsap: true,
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.guestId).toBe(validGuestId);
        expect(res.data.submittedName).toBe("Jean-Paul Dupont");
        // Canonical stored guest name was NOT overwritten
        expect(mockGuests.find((g) => g.id === validGuestId)?.name).toBe("Jean Dupont");
      }
    });

    it("updates canonical guest name when updateGuestName is true", async () => {
      const res = await createManualOrderAction({
        guestPhone: "06 12 34 56 78",
        guestName: "Jean-Paul Dupont",
        updateGuestName: true,
        serviceType: "pickup",
        channel: "phone",
        isAsap: true,
        items: [{ productId: validProductId, quantity: 1 }],
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.guestId).toBe(validGuestId);
        expect(res.data.submittedName).toBeNull();
        // Canonical stored guest name WAS updated
        expect(mockGuests.find((g) => g.id === validGuestId)?.name).toBe("Jean-Paul Dupont");
      }
    });
  });

  describe("progressOrderStatusAction", () => {
    it("rejects invalid status transitions via domain state machine", async () => {
      // CONFIRMED cannot jump directly to COMPLETED
      const res = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "COMPLETED",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("Cannot transition");
      }
    });

    it("rejects transition to COMPLETED while order is unpaid", async () => {
      // First advance to PREPARING then READY
      await progressOrderStatusAction({ orderId: validOrderId, nextStatus: "PREPARING" });
      await progressOrderStatusAction({ orderId: validOrderId, nextStatus: "READY" });

      // Now attempt COMPLETED while unpaid
      const res = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "COMPLETED",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("Cannot transition to COMPLETED while order is unpaid");
      }
    });

    it("successfully progresses status and records timestamp in history", async () => {
      const res = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "PREPARING",
        reason: "Chef started",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.status).toBe("PREPARING");
        const lastEvent = res.data.statusHistory?.[res.data.statusHistory.length - 1];
        expect(lastEvent?.status).toBe("PREPARING");
        expect(lastEvent?.note).toBe("Chef started");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/orders");
      }
    });

    it("restores stock when order is cancelled", async () => {
      const initialStock = mockProducts[0].stock;
      const res = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "CANCELLED",
        reason: "Cancelled by guest",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.status).toBe("CANCELLED");
        expect(res.data.cancellationReason).toBe("Cancelled by guest");
        // Item quantity was 2, so stock should be restored by +2
        expect(mockProducts[0].stock).toBe(initialStock + 2);
      }
    });

    it("confirms a NEW order", async () => {
      mockOrders[0].status = "NEW";
      const res = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "CONFIRMED",
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.status).toBe("CONFIRMED");
      }
    });

    it("rejects an invalid order ID", async () => {
      const res = await progressOrderStatusAction({
        orderId: "not-a-uuid",
        nextStatus: "CONFIRMED",
      });
      expect(res).toMatchObject({ ok: false, code: "VALIDATION" });
    });

    it("requires a reason when rejecting a new order", async () => {
      mockOrders[0].status = "NEW";
      const res = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "CANCELLED",
        reason: "   ",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("A reason is required when rejecting a new order");
      }
    });

    it("cancels a NEW order, restores stock and refreshes the storefront", async () => {
      mockOrders[0].status = "NEW";
      const initialStock = mockProducts[0].stock;
      const res = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "CANCELLED",
        reason: "Kitchen out of ingredients",
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.status).toBe("CANCELLED");
        expect(res.data.cancellationReason).toBe("Kitchen out of ingredients");
        expect(mockProducts[0].stock).toBe(initialStock + 2);
        expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/products");
        expect(mockUpdateTag).toHaveBeenCalledWith("storefront-catalog");
      }
    });
  });

  describe("recordPaymentAction", () => {
    it("records payment method and timestamp, enabling progression to COMPLETED", async () => {
      // Order is READY
      mockOrders[0].status = "READY";
      mockOrders[0].paid = "unpaid";

      const payRes = await recordPaymentAction({
        orderId: validOrderId,
        paymentMethod: "cash",
      });
      expect(payRes.ok).toBe(true);
      if (payRes.ok) {
        expect(payRes.data.paid).toBe("paid");
        expect(payRes.data.paymentMethod).toBe("cash");
        expect(payRes.data.paidAt).toBeDefined();
      }

      // Now completing order succeeds!
      const compRes = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "COMPLETED",
      });
      expect(compRes.ok).toBe(true);
      if (compRes.ok) {
        expect(compRes.data.status).toBe("COMPLETED");
      }
    });

    it("rejects recording payment when order status is CANCELLED (AC: Payment can be recorded at any status except CANCELLED)", async () => {
      mockOrders[0].status = "CANCELLED";
      mockOrders[0].paid = "unpaid";

      const res = await recordPaymentAction({
        orderId: validOrderId,
        paymentMethod: "revolut",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/cancelled/i);
      }
    });

    it("rejects invalid input schema", async () => {
      const res = await recordPaymentAction({
        orderId: "not-a-uuid",
        paymentMethod: "invalid",
      });
      expect(res.ok).toBe(false);
    });
  });

  describe("markOrderUnpaidAction", () => {
    it("marks a paid order as unpaid to undo a mistake, clearing paymentMethod and paidAt", async () => {
      mockOrders[0].status = "PREPARING";
      mockOrders[0].paid = "paid";
      mockOrders[0].paymentMethod = "revolut";
      mockOrders[0].paidAt = new Date().toISOString();

      const res = await markOrderUnpaidAction({ orderId: validOrderId });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.paid).toBe("unpaid");
        expect(res.data.paymentMethod).toBeNull();
        expect(res.data.paidAt).toBeNull();
        const lastEntry = res.data.statusHistory?.[res.data.statusHistory.length - 1];
        expect(lastEntry?.note).toContain("unpaid");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/orders");
      }
    });

    it("rejects when order is already unpaid", async () => {
      mockOrders[0].paid = "unpaid";

      const res = await markOrderUnpaidAction({ orderId: validOrderId });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/already/i);
      }
    });

    it("rejects when order is already COMPLETED", async () => {
      mockOrders[0].status = "COMPLETED";
      mockOrders[0].paid = "paid";

      const res = await markOrderUnpaidAction({ orderId: validOrderId });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/completed/i);
      }
    });

    it("rejects when order is refunded", async () => {
      mockOrders[0].paid = "refunded";

      const res = await markOrderUnpaidAction({ orderId: validOrderId });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/refunded/i);
      }
    });
  });

  describe("markPaidAndCompleteAction", () => {
    it("shortcuts payment recording and marks order COMPLETED when status is READY", async () => {
      mockOrders[0].status = "READY";
      mockOrders[0].paid = "unpaid";
      mockOrders[0].paymentMethod = null;

      const res = await markPaidAndCompleteAction({
        orderId: validOrderId,
        paymentMethod: "wero",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.paid).toBe("paid");
        expect(res.data.paymentMethod).toBe("wero");
        expect(res.data.paidAt).toBeDefined();
        expect(res.data.status).toBe("COMPLETED");
        const lastEntry = res.data.statusHistory?.[res.data.statusHistory.length - 1];
        expect(lastEntry?.status).toBe("COMPLETED");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/orders");
      }
    });

    it("rejects shortcut if order is not in READY status (e.g. PREPARING)", async () => {
      mockOrders[0].status = "PREPARING";
      mockOrders[0].paid = "unpaid";

      const res = await markPaidAndCompleteAction({
        orderId: validOrderId,
        paymentMethod: "cash",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/ready/i);
      }
    });

    it("rejects shortcut if order is CANCELLED", async () => {
      mockOrders[0].status = "CANCELLED";
      mockOrders[0].paid = "unpaid";

      const res = await markPaidAndCompleteAction({
        orderId: validOrderId,
        paymentMethod: "cash",
      });

      expect(res.ok).toBe(false);
    });
  });

  describe("recordRefundAction", () => {
    it("is owner-only: a manager gets FORBIDDEN and nothing is recorded", async () => {
      authState.role = "manager";
      mockOrders[1].status = "COMPLETED";
      mockOrders[1].paid = "paid";
      const spy = vi.spyOn(mockOrderRepo, "recordRefund");

      const res = await recordRefundAction({ orderId: completedOrderId });

      expect(res).toMatchObject({ ok: false, code: "FORBIDDEN" });
      expect(spy).not.toHaveBeenCalled();
    });

    it("never forwards a raw non-repository error message", async () => {
      mockOrders[1].status = "COMPLETED";
      mockOrders[1].paid = "paid";
      vi.spyOn(mockOrderRepo, "recordRefund").mockRejectedValueOnce(
        new Error('duplicate key value violates "orders_pkey"'),
      );

      const res = await recordRefundAction({ orderId: completedOrderId });

      expect(res).toMatchObject({ ok: false, code: "INTERNAL" });
      expect(JSON.stringify(res)).not.toContain("orders_pkey");
    });

    it("records refund for a cancelled paid order, setting paid to 'refunded' and recording refundedAt", async () => {
      mockOrders[0].status = "CANCELLED";
      mockOrders[0].paid = "paid";
      mockOrders[0].paidAt = new Date().toISOString();

      const res = await recordRefundAction({
        orderId: validOrderId,
        reason: "Customer cancelled and payment was returned via Revolut",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.paid).toBe("refunded");
        expect(res.data.refundedAt).toBeDefined();
        const lastHistory = res.data.statusHistory?.[res.data.statusHistory.length - 1];
        expect(lastHistory?.note).toContain("Refund recorded");
      }
    });

    it("allows recording refund on COMPLETED order for post-delivery dispute", async () => {
      mockOrders[1].status = "COMPLETED";
      mockOrders[1].paid = "paid";

      const res = await recordRefundAction({
        orderId: completedOrderId,
        reason: "Cold food complaint refund",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.paid).toBe("refunded");
        expect(res.data.status).toBe("COMPLETED");
        expect(res.data.refundedAt).toBeDefined();
      }
    });

    it("rejects refund when order is unpaid", async () => {
      mockOrders[0].status = "CANCELLED";
      mockOrders[0].paid = "unpaid";

      const res = await recordRefundAction({
        orderId: validOrderId,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/unpaid/i);
      }
    });

    it("rejects refund when order is already refunded", async () => {
      mockOrders[0].paid = "refunded";

      const res = await recordRefundAction({
        orderId: validOrderId,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/already/i);
      }
    });

    it("prevents transitioning a refunded order to COMPLETED", async () => {
      mockOrders[0].status = "READY";
      mockOrders[0].paid = "refunded";

      const res = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "COMPLETED",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/refunded/i);
      }
    });
  });

  describe("lookupGuestByPhoneAction", () => {
    it("returns null when phone is empty or too short", async () => {
      const res = await lookupGuestByPhoneAction("12");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toBeNull();
      }
    });

    it("rejects phone input longer than 30 characters", async () => {
      const res = await lookupGuestByPhoneAction("1".repeat(31));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe("VALIDATION");
    });

    it("finds existing guest by phone", async () => {
      const res = await lookupGuestByPhoneAction("06 12 34 56 78");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data?.name).toBe("Jean Dupont");
      }
    });
  });

  describe("state conflicts and refunded orders", () => {
    it("returns the ORDER_STATE_CONFLICT code when the order changed since it was read", async () => {
      mockOrderRepo.transition.mockRejectedValueOnce(
        new OrderRepoError("The order changed, please reload.", "ORDER_STATE_CONFLICT"),
      );
      const res = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "PREPARING",
      });
      expect(res).toEqual({
        ok: false,
        code: "CONFLICT",
        reason: "ORDER_STATE_CONFLICT",
        message: "The order changed, please reload.",
        lineErrors: undefined,
      });
    });

    it("passes the expected status it validated against to the atomic transition", async () => {
      const res = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "PREPARING",
      });
      expect(res.ok).toBe(true);
      expect(mockOrderRepo.transition).toHaveBeenCalledWith(testBusinessId, validOrderId, {
        expectedStatus: "CONFIRMED",
        nextStatus: "PREPARING",
        reason: null,
      });
    });

    it("does not record payment on a refunded order", async () => {
      mockOrders = mockOrders.map((o) =>
        o.id === validOrderId ? { ...o, paid: "refunded" as const } : o,
      );
      const res = await recordPaymentAction({ orderId: validOrderId, paymentMethod: "cash" });
      expect(res.ok).toBe(false);
      expect(mockOrderRepo.recordPayment).not.toHaveBeenCalled();
    });

    it("does not mark a refunded READY order paid and complete", async () => {
      mockOrders = mockOrders.map((o) =>
        o.id === validOrderId ? { ...o, status: "READY" as const, paid: "refunded" as const } : o,
      );
      const res = await markPaidAndCompleteAction({ orderId: validOrderId, paymentMethod: "cash" });
      expect(res.ok).toBe(false);
      expect(mockOrderRepo.recordPayment).not.toHaveBeenCalled();
    });
  });
});
