import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import OrdersPage from "../(authenticated)/orders/page";
import OrderDetailPage from "../(authenticated)/orders/[id]/page";
import NewOrderPage from "../(authenticated)/orders/new/page";
import * as auth from "@/lib/auth";

afterEach(() => {
  vi.clearAllMocks();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  notFound: vi.fn(),
}));

const mockSession = {
  user: {
    id: "00000000-0000-4000-8000-000000000002",
    email: "manager@test.com",
    name: "Manager",
    role: "manager" as const,
    businessId: "11111111-1111-4111-8111-111111111111",
  },
  business: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Test Shop",
    slug: "test-shop",
    currency: "EUR" as const,
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
};

vi.mock("@/lib/request-time", () => ({
  getRequestNow: vi.fn(async () => new Date("2026-10-15T12:00:00Z")),
}));

vi.mock("@/features/settings/settings-data", () => ({
  getBusinessToday: vi.fn(async () => "2026-10-15"),
}));

vi.mock("@/lib/auth", () => ({
  requireManagerSession: vi.fn(async () => mockSession),
}));

vi.mock("@/lib/repositories", () => ({
  getRepositories: () => ({
    products: {
      list: vi.fn(async () => [
        {
          id: "p-1",
          businessId: "11111111-1111-4111-8111-111111111111",
          categoryId: "cat-1",
          name: "Burger Maison",
          description: null,
          price: 850,
          unitCost: 300,
          stock: 12,
          visible: true,
          imageUrl: null,
          createdAt: "2026-10-01T10:00:00.000Z",
          updatedAt: "2026-10-01T10:00:00.000Z",
        },
      ]),
    },
  }),
}));

vi.mock("@/features/orders/order-data", async (importActual) => ({
  ...(await importActual<typeof import("@/features/orders/order-data")>()),
  listOrders: vi.fn(async () => ({
    ...{
      orders: [
        {
          id: "ord-1",
          businessId: "11111111-1111-4111-8111-111111111111",
          orderNumber: 42,
          guestId: "g-1",
          guestName: "Jean Dupont",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "phone",
          status: "NEW",
          paid: "unpaid",
          paymentPreference: "on_handover",
          paymentMethod: null,
          paidAt: null,
          requestedDate: "2026-10-13",
          requestedTime: null,
          items: [
            {
              id: "it-1",
              productId: "p-1",
              productName: "Burger Maison",
              quantity: 2,
              unitPrice: 850,
              totalPrice: 1700,
            },
          ],
          totalAmount: 1700,
          trackingToken: "token42",
          cancellationReason: null,
          notes: null,
          deliveryAddress: null,
          statusHistory: [],
          createdAt: "2026-10-13T12:00:00.000Z",
          updatedAt: "2026-10-13T12:00:00.000Z",
        },
      ],
      counts: { active: 1, completed: 0, cancelled: 0, total: 1, unpaid: 1 },
    },
  })),
  getOrder: vi.fn(async (id: string) => {
    if (id === "ord-1") {
      return {
        ...{
          order: {
            id: "ord-1",
            businessId: "11111111-1111-4111-8111-111111111111",
            orderNumber: 42,
            guestId: "g-1",
            guestName: "Jean Dupont",
            guestPhone: "+33612345678",
            serviceType: "pickup",
            channel: "phone",
            status: "NEW",
            paid: "unpaid",
            paymentPreference: "on_handover",
            paymentMethod: null,
            paidAt: null,
            requestedDate: "2026-10-13",
            requestedTime: null,
            items: [
              {
                id: "it-1",
                productId: "p-1",
                productName: "Burger Maison",
                quantity: 2,
                unitPrice: 850,
                totalPrice: 1700,
              },
            ],
            totalAmount: 1700,
            trackingToken: "token42",
            cancellationReason: null,
            notes: null,
            deliveryAddress: null,
            statusHistory: [
              { status: "NEW", timestamp: "2026-10-13T12:00:00.000Z", note: "Order placed" },
            ],
            createdAt: "2026-10-13T12:00:00.000Z",
            updatedAt: "2026-10-13T12:00:00.000Z",
          },
          guest: null,
        },
      };
    }
    return null;
  }),
}));

vi.mock("@/features/orders", () => ({
  createManualOrderAction: vi.fn(),
  progressOrderStatusAction: vi.fn(),
  recordPaymentAction: vi.fn(),
  lookupGuestByPhoneAction: vi.fn(),
}));

describe("Orders Pages", () => {
  describe("OrdersPage (Screen M-20)", () => {
    it("authenticates session and renders order list", async () => {
      const page = await OrdersPage();
      render(page);

      expect(auth.requireManagerSession).toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: "Orders", level: 1 })).toBeDefined();
      expect(screen.getByText("Jean Dupont")).toBeDefined();
      expect(screen.getByText("#42")).toBeDefined();
    });
  });

  describe("OrderDetailPage (Screen M-21)", () => {
    it("renders order detail for valid order ID", async () => {
      const page = await OrderDetailPage({ params: Promise.resolve({ id: "ord-1" }) });
      render(page);

      expect(auth.requireManagerSession).toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: "Order #42", level: 1 })).toBeDefined();
      expect(screen.getByText("Jean Dupont")).toBeDefined();
    });
  });

  describe("NewOrderPage (Screen M-30)", () => {
    it("renders manual order entry form with products", async () => {
      const page = await NewOrderPage();
      render(page);

      expect(auth.requireManagerSession).toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: "New Order", level: 1 })).toBeDefined();
      expect(screen.getByText("Burger Maison")).toBeDefined();
      expect(screen.getByText("12 in stock")).toBeDefined();
    });
  });
});
