import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Expense, Order, Product } from "@/domain";
import { getDashboardData } from "../dashboard-data";

const testBusinessId = "11111111-1111-4111-8111-111111111111";
const guestBobId = "77777777-7777-4111-8111-777777777701";
const guestCharlieId = "77777777-7777-4111-8111-777777777702";

let mockOrders: Order[] = [];
let mockExpenses: Expense[] = [];
let mockProducts: Product[] = [];
let mockTimezone = "UTC";

const mockOrderRepo = {
  list: vi.fn(async () => mockOrders),
};

const mockGuestRepo = {
  list: vi.fn(async () => [
    {
      id: guestBobId,
      businessId: testBusinessId,
      name: "Bob",
      phone: "+33612345678",
      email: null,
      address: null,
      notes: null,
      createdAt: "2026-10-01T10:00:00.000Z",
    },
    {
      id: guestCharlieId,
      businessId: testBusinessId,
      name: "Charlie",
      phone: "+33612345679",
      email: null,
      address: null,
      notes: null,
      createdAt: "2026-10-01T10:00:00.000Z",
    },
  ]),
};

const mockExpenseRepo = {
  list: vi.fn(async () => mockExpenses),
};

const mockProductRepo = {
  list: vi.fn(async () => mockProducts),
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: () => ({
    orders: mockOrderRepo,
    guests: mockGuestRepo,
    expenses: mockExpenseRepo,
    products: mockProductRepo,
    business: { getSettings: vi.fn(async () => ({ timezone: mockTimezone })) },
  }),
}));

vi.mock("@/lib/request-time", () => ({
  getRequestNow: vi.fn(async () => new Date("2026-10-15T12:00:00Z")),
}));

const mockRequireAuthenticatedAction = vi.fn(async () => ({
  session: {
    user: { id: "user-1", email: "manager@test.com" },
    business: { id: testBusinessId, name: "Test Kitchen", slug: "test-kitchen" },
    role: "manager" as const,
  },
  businessId: testBusinessId,
}));

vi.mock("@/features/auth", () => ({
  requireAuthenticatedAction: () => mockRequireAuthenticatedAction(),
}));

describe("Dashboard Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTimezone = "UTC";

    mockOrders = [
      {
        id: "22222222-2222-4111-8111-222222222222",
        businessId: testBusinessId,
        orderNumber: 1042,
        guestId: guestBobId,
        serviceType: "pickup",
        channel: "storefront",
        status: "CONFIRMED",
        paid: "paid",
        paymentPreference: "on_handover",
        paymentMethod: "cash",
        paidAt: "2026-10-15T12:00:00.000Z",
        requestedDate: "2026-10-15",
        requestedTime: "12:30",
        items: [
          {
            productId: "33333333-3333-4111-8111-333333333333",
            productName: "Smash Burger",
            quantity: 2,
            unitPrice: 1200,
            totalPrice: 2400,
          },
        ],
        totalAmount: 2400,
        createdAt: "2026-10-15T10:00:00.000Z",
        updatedAt: "2026-10-15T10:05:00.000Z",
      },
      {
        id: "22222222-2222-4111-8111-222222222223",
        businessId: testBusinessId,
        orderNumber: 1043,
        guestId: guestCharlieId,
        serviceType: "delivery",
        channel: "storefront",
        status: "PREPARING",
        paid: "unpaid",
        paymentPreference: "on_handover",
        requestedDate: "2026-10-15",
        requestedTime: "13:00",
        items: [
          {
            productId: "33333333-3333-4111-8111-333333333334",
            productName: "Salad",
            quantity: 1,
            unitPrice: 1500,
            totalPrice: 1500,
          },
        ],
        totalAmount: 1500,
        createdAt: "2026-10-15T11:00:00.000Z",
        updatedAt: "2026-10-15T11:05:00.000Z",
      },
    ];

    mockExpenses = [
      {
        id: "44444444-4444-4111-8111-444444444444",
        businessId: testBusinessId,
        amount: 500,
        date: "2026-10-15",
        description: "Fresh Veggies",
        tags: ["Ingredients"],
        createdAt: "2026-10-15T09:00:00.000Z",
      },
    ];

    mockProducts = [
      {
        id: "55555555-5555-4111-8111-555555555555",
        businessId: testBusinessId,
        categoryId: "66666666-6666-4111-8111-666666666666",
        name: "Brioche Buns",
        description: null,
        price: 350,
        unitCost: 100,
        stock: 3,
        visible: true,
        allergens: [],
        suggestAddOns: true,
        imageUrl: null,
        createdAt: "2026-10-10T10:00:00.000Z",
        updatedAt: "2026-10-10T10:00:00.000Z",
      },
    ];
  });

  it("loads dashboard data with the default 'today' preset", async () => {
    const data = await getDashboardData(undefined, new Date("2026-10-15T12:00:00Z"));

    expect(data.periodPreset).toBe("today");
    expect(data.kpis.current.revenue).toBe(2400);
    expect(data.kpis.current.costs).toBe(500);
    expect(data.kpis.current.profit).toBe(1900);
    expect(data.triage.toPrepare.count).toBe(2);
    expect(data.triage.unpaid.count).toBe(1);
    expect(data.triage.unpaid.totalAmount).toBe(1500);
    expect(data.triage.lowStock.count).toBe(1);
    expect(data.activity).toHaveLength(3);
  });

  it("resolves 'today' on the business calendar, not the server's UTC one", async () => {
    // 23:30 UTC on 14 Oct is already 15 Oct (01:30) in Paris
    mockTimezone = "Europe/Paris";
    const data = await getDashboardData("today", new Date("2026-10-14T23:30:00Z"));
    expect(data.period).toEqual({ startDate: "2026-10-15", endDate: "2026-10-15" });
    expect(data.generatedAt).toBe("2026-10-14T23:30:00.000Z");
  });

  it("supports periodPreset filtering ('last_7_days')", async () => {
    const data = await getDashboardData("last_7_days", new Date("2026-10-15T12:00:00Z"));

    expect(data.periodPreset).toBe("last_7_days");
    expect(data.period.startDate).toBe("2026-10-09");
    expect(data.period.endDate).toBe("2026-10-15");
  });

  it("throws on authentication or repository failure instead of returning empty data", async () => {
    mockRequireAuthenticatedAction.mockRejectedValueOnce(new Error("Unauthorized access"));
    await expect(getDashboardData()).rejects.toThrow("Unauthorized access");

    mockOrderRepo.list.mockRejectedValueOnce(new Error("Offline"));
    await expect(getDashboardData()).rejects.toThrow("Offline");
  });
});
