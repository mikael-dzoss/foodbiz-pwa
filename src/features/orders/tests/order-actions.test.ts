import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Order, Product, Guest, CreateOrderInput, UpdateOrderInput } from "@/domain";
import {
  listOrdersAction,
  getOrderAction,
  createManualOrderAction,
  progressOrderStatusAction,
  recordPaymentAction,
  lookupGuestByPhoneAction,
} from "../order-actions";

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

const testBusinessId = "11111111-1111-4111-8111-111111111111";
const validGuestId = "55555555-5555-4555-8555-555555555501";
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
  create: vi.fn(async (bId: string, input: CreateOrderInput) => {
    const o: Order = {
      id: input.id ?? "66666666-6666-4666-8666-666666666699",
      businessId: bId,
      orderNumber: input.orderNumber ?? mockOrders.length + 1,
      guestId: input.guestId ?? null,
      guestName: input.guestName,
      serviceType: input.serviceType,
      channel: input.channel,
      status: input.status,
      paid: input.paid,
      paymentPreference: input.paymentPreference,
      paymentMethod: input.paymentMethod ?? null,
      paidAt: input.paidAt ?? null,
      requestedDate: input.requestedDate,
      requestedTime: input.requestedTime ?? null,
      items: input.items,
      totalAmount: input.totalAmount,
      trackingToken: "track123",
      cancellationReason: input.cancellationReason ?? null,
      notes: input.notes ?? null,
      deliveryAddress: input.deliveryAddress ?? null,
      statusHistory: input.statusHistory ?? [
        { status: input.status, timestamp: new Date().toISOString(), note: null },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockOrders.push(o);
    return structuredClone(o);
  }),
  update: vi.fn(async (_bId: string, id: string, input: UpdateOrderInput) => {
    const idx = mockOrders.findIndex((o) => o.id === id);
    if (idx === -1) throw new Error("Order not found");
    const updated = { ...mockOrders[idx], ...input, updatedAt: new Date().toISOString() };
    mockOrders[idx] = updated;
    return structuredClone(updated);
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

vi.mock("@/lib/repositories", () => ({
  getRepositories: () => ({
    orders: mockOrderRepo,
    guests: mockGuestRepo,
    products: mockProductRepo,
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

vi.mock("@/features/auth", () => ({
  requireAuthenticatedAction: () => mockRequireAuthenticatedAction(),
}));

describe("Order Server Actions", () => {
  beforeEach(() => {
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
        guestName: "Jean Dupont",
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
        guestId: null,
        guestName: "Sophie Martin",
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
        guestName: "Jean Dupont",
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
      expect(res.success).toBe(true);
      if (res.success) {
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
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.orders).toHaveLength(1);
        expect(res.data.orders[0].id).toBe(completedOrderId);
      }
    });

    it("filters orders by cancelled statusTab", async () => {
      const res = await listOrdersAction({ statusTab: "cancelled" });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.orders).toHaveLength(1);
        expect(res.data.orders[0].id).toBe(cancelledOrderId);
      }
    });

    it("filters orders by unpaidOnly", async () => {
      const res = await listOrdersAction({ statusTab: "all", unpaidOnly: true });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.orders).toHaveLength(2);
        expect(res.data.orders.every((o) => o.paid === "unpaid")).toBe(true);
      }
    });

    it("filters orders by serviceType", async () => {
      const res = await listOrdersAction({ statusTab: "all", serviceType: "delivery" });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.orders).toHaveLength(1);
        expect(res.data.orders[0].serviceType).toBe("delivery");
      }
    });

    it("searches orders by order number, guest name, or phone", async () => {
      // Order number search
      const resNum = await listOrdersAction({ statusTab: "all", search: "42" });
      expect(resNum.success).toBe(true);
      if (resNum.success) expect(resNum.data.orders).toHaveLength(1);

      // Name search
      const resName = await listOrdersAction({ statusTab: "all", search: "Sophie" });
      expect(resName.success).toBe(true);
      if (resName.success) expect(resName.data.orders[0].guestName).toBe("Sophie Martin");

      // Phone search
      const resPhone = await listOrdersAction({ statusTab: "all", search: "12345678" });
      expect(resPhone.success).toBe(true);
      if (resPhone.success) expect(resPhone.data.orders[0].guestName).toBe("Jean Dupont");
    });

    it("sorts orders with ASAP before scheduled times", async () => {
      // Add another active order with scheduled time on the same date
      mockOrders.push({
        id: "order-scheduled",
        businessId: testBusinessId,
        orderNumber: 43,
        guestId: null,
        guestName: "Claire",
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
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.orders).toHaveLength(2);
        // Order #42 has requestedTime: null (ASAP), should come first!
        expect(res.data.orders[0].id).toBe(validOrderId);
        expect(res.data.orders[1].id).toBe("order-scheduled");
      }
    });
  });

  describe("getOrderAction", () => {
    it("returns order with enriched guest phone and address", async () => {
      const res = await getOrderAction(validOrderId);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.order.guestName).toBe("Jean Dupont");
        expect(res.data.order.guestPhone).toBe("+33612345678");
        expect(res.data.guest).not.toBeNull();
      }
    });

    it("returns error for non-existent order", async () => {
      const res = await getOrderAction("00000000-0000-4000-8000-000000000000");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Order not found");
      }
    });
  });

  describe("createManualOrderAction", () => {
    it("rejects invalid input schema with field errors", async () => {
      const res = await createManualOrderAction({
        guestPhone: "",
        guestName: "",
        items: [],
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.fieldErrors).toBeDefined();
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
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("Insufficient stock");
      }
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

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.status).toBe("CONFIRMED");
        expect(res.data.guestId).toBe(validGuestId);
        expect(res.data.items[0].quantity).toBe(3);
        expect(res.data.totalAmount).toBe(2550); // 3 * 850
        // Product stock decremented
        expect(mockProducts[0].stock).toBe(initialStock - 3);
        // Status history recorded
        expect(res.data.statusHistory?.[0].status).toBe("CONFIRMED");
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

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.guestName).toBe("Nouveau Client");
        expect(res.data.deliveryAddress).toBe("88 Rue Neuve");
        expect(mockGuests.some((g) => g.phone === "+33699887766")).toBe(true);
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
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("Cannot transition");
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
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("Cannot transition to COMPLETED while order is unpaid");
      }
    });

    it("successfully progresses status and records timestamp in history", async () => {
      const res = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "PREPARING",
        reason: "Chef started",
      });

      expect(res.success).toBe(true);
      if (res.success) {
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

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.status).toBe("CANCELLED");
        expect(res.data.cancellationReason).toBe("Cancelled by guest");
        // Item quantity was 2, so stock should be restored by +2
        expect(mockProducts[0].stock).toBe(initialStock + 2);
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
      expect(payRes.success).toBe(true);
      if (payRes.success) {
        expect(payRes.data.paid).toBe("paid");
        expect(payRes.data.paymentMethod).toBe("cash");
        expect(payRes.data.paidAt).toBeDefined();
      }

      // Now completing order succeeds!
      const compRes = await progressOrderStatusAction({
        orderId: validOrderId,
        nextStatus: "COMPLETED",
      });
      expect(compRes.success).toBe(true);
      if (compRes.success) {
        expect(compRes.data.status).toBe("COMPLETED");
      }
    });
  });

  describe("lookupGuestByPhoneAction", () => {
    it("returns null when phone is empty or too short", async () => {
      const res = await lookupGuestByPhoneAction("12");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toBeNull();
      }
    });

    it("finds existing guest by phone", async () => {
      const res = await lookupGuestByPhoneAction("06 12 34 56 78");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data?.name).toBe("Jean Dupont");
      }
    });
  });
});
