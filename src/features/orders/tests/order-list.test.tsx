import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { OrderList } from "../components/order-list";
import type { ListOrdersResult } from "../order-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockInitialData: ListOrdersResult = {
  counts: {
    active: 2,
    completed: 1,
    cancelled: 1,
    total: 4,
    unpaid: 2,
    pickup: 2,
    delivery: 2,
  },
  orders: [
    {
      id: "ord-1",
      businessId: "biz-1",
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
      trackingToken: "tk-42",
      cancellationReason: null,
      notes: "Extra sauce",
      deliveryAddress: null,
      createdAt: "2026-10-13T12:00:00.000Z",
      updatedAt: "2026-10-13T12:00:00.000Z",
    },
    {
      id: "ord-2",
      businessId: "biz-1",
      orderNumber: 41,
      guestId: "g-2",
      guestName: "Sophie Martin",
      guestPhone: "+33687654321",
      serviceType: "delivery",
      channel: "storefront",
      status: "PREPARING",
      paid: "paid",
      paymentPreference: "revolut",
      paymentMethod: "revolut",
      paidAt: "2026-10-13T11:00:00.000Z",
      requestedDate: "2026-10-13",
      requestedTime: "19:30",
      items: [
        {
          id: "it-2",
          productId: "p-2",
          productName: "Salade César",
          quantity: 1,
          unitPrice: 900,
          totalPrice: 900,
        },
      ],
      totalAmount: 900,
      trackingToken: "tk-41",
      cancellationReason: null,
      notes: null,
      deliveryAddress: "123 Rue de la Paix",
      createdAt: "2026-10-13T11:00:00.000Z",
      updatedAt: "2026-10-13T11:00:00.000Z",
    },
    {
      id: "ord-3",
      businessId: "biz-1",
      orderNumber: 40,
      guestId: "g-3",
      guestName: "Marc Leroy",
      guestPhone: null,
      serviceType: "delivery",
      channel: "in-person",
      status: "COMPLETED",
      paid: "paid",
      paymentPreference: "on_handover",
      paymentMethod: "cash",
      paidAt: "2026-10-13T10:00:00.000Z",
      requestedDate: "2026-10-13",
      requestedTime: "12:00",
      items: [
        {
          id: "it-3",
          productId: "p-1",
          productName: "Burger Maison",
          quantity: 1,
          unitPrice: 850,
          totalPrice: 850,
        },
      ],
      totalAmount: 850,
      trackingToken: "tk-40",
      cancellationReason: null,
      notes: null,
      deliveryAddress: null,
      createdAt: "2026-10-13T09:00:00.000Z",
      updatedAt: "2026-10-13T10:00:00.000Z",
    },
    {
      id: "ord-4",
      businessId: "biz-1",
      orderNumber: 39,
      guestId: "g-4",
      guestName: "Lucie Dubois",
      guestPhone: "+33699999999",
      serviceType: "pickup",
      channel: "phone",
      status: "CANCELLED",
      paid: "unpaid",
      paymentPreference: "on_handover",
      paymentMethod: null,
      paidAt: null,
      requestedDate: "2026-10-12",
      requestedTime: null,
      items: [],
      totalAmount: 500,
      trackingToken: "tk-39",
      cancellationReason: "Client absent",
      notes: null,
      deliveryAddress: null,
      createdAt: "2026-10-12T18:00:00.000Z",
      updatedAt: "2026-10-12T18:30:00.000Z",
    },
  ],
};

describe("OrderList Component", () => {
  it("renders status tabs with counts", () => {
    render(<OrderList initialData={mockInitialData} />);
    expect(screen.getByTestId("tab-active").textContent).toContain("Active");
    expect(screen.getByTestId("tab-active").textContent).toContain("2");
    expect(screen.getByTestId("tab-completed").textContent).toContain("Completed");
    expect(screen.getByTestId("tab-completed").textContent).toContain("1");
    expect(screen.getByTestId("tab-cancelled").textContent).toContain("Cancelled");
    expect(screen.getByTestId("tab-cancelled").textContent).toContain("1");
  });

  it("shows active orders by default and highlights NEW orders", () => {
    render(<OrderList initialData={mockInitialData} />);
    // Active orders ord-1 and ord-2 should be visible
    expect(screen.getByTestId("order-card-ord-1")).toBeDefined();
    expect(screen.getByTestId("order-card-ord-2")).toBeDefined();

    // Completed ord-3 and cancelled ord-4 should not be in active tab
    expect(screen.queryByTestId("order-card-ord-3")).toBeNull();
    expect(screen.queryByTestId("order-card-ord-4")).toBeNull();

    // Check NEW highlight
    const newCard = screen.getByTestId("order-card-ord-1");
    expect(newCard.className).toContain("border-info");
    expect(newCard.textContent).toContain("NEW");
  });

  it("switches to completed tab and displays completed orders", () => {
    render(<OrderList initialData={mockInitialData} />);
    fireEvent.click(screen.getByTestId("tab-completed"));

    expect(screen.getByTestId("order-card-ord-3")).toBeDefined();
    expect(screen.queryByTestId("order-card-ord-1")).toBeNull();
  });

  it("switches to cancelled tab and displays cancelled orders", () => {
    render(<OrderList initialData={mockInitialData} />);
    fireEvent.click(screen.getByTestId("tab-cancelled"));

    expect(screen.getByTestId("order-card-ord-4")).toBeDefined();
    expect(screen.queryByTestId("order-card-ord-1")).toBeNull();
  });

  it("filters active orders by unpaidOnly", () => {
    render(<OrderList initialData={mockInitialData} />);
    const unpaidButton = screen.getByTestId("filter-unpaid");
    fireEvent.click(unpaidButton);

    // ord-1 is unpaid, ord-2 is paid
    expect(screen.getByTestId("order-card-ord-1")).toBeDefined();
    expect(screen.queryByTestId("order-card-ord-2")).toBeNull();
  });

  it("filters active orders by serviceType", () => {
    render(<OrderList initialData={mockInitialData} />);
    fireEvent.click(screen.getByTestId("filter-service-delivery"));

    // ord-2 is delivery, ord-1 is pickup
    expect(screen.getByTestId("order-card-ord-2")).toBeDefined();
    expect(screen.queryByTestId("order-card-ord-1")).toBeNull();
  });

  it("searches orders by guest name or phone or order number", () => {
    render(<OrderList initialData={mockInitialData} />);
    const searchInput = screen.getByTestId("order-search-input");

    // Search by guest name
    fireEvent.change(searchInput, { target: { value: "Sophie" } });
    expect(screen.getByTestId("order-card-ord-2")).toBeDefined();
    expect(screen.queryByTestId("order-card-ord-1")).toBeNull();

    // Search by order reference
    fireEvent.change(searchInput, { target: { value: "42" } });
    expect(screen.getByTestId("order-card-ord-1")).toBeDefined();
    expect(screen.queryByTestId("order-card-ord-2")).toBeNull();
  });

  it("renders empty state when no orders match search", () => {
    render(<OrderList initialData={mockInitialData} />);
    const searchInput = screen.getByTestId("order-search-input");
    fireEvent.change(searchInput, { target: { value: "NonExistent" } });

    expect(screen.getByTestId("orders-empty-state")).toBeDefined();
    expect(screen.getByText("No orders found")).toBeDefined();
  });
});
