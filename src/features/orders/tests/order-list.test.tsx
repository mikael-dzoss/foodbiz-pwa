import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrderList } from "../components/order-list";
import { BusinessTimeZoneProvider } from "@/components/time/business-timezone";
import type { ListOrdersResult } from "../order-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const mockInitialData: ListOrdersResult = {
  counts: {
    active: 2,
    completed: 1,
    cancelled: 3,
    total: 6,
    unpaid: 2,
    pickup: 4,
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
    {
      id: "ord-5",
      businessId: "biz-1",
      orderNumber: 38,
      guestId: "g-5",
      guestName: "Emma Stone",
      guestPhone: "+33611112222",
      serviceType: "pickup",
      channel: "storefront",
      status: "CANCELLED",
      paid: "paid",
      paymentPreference: "revolut",
      paymentMethod: "revolut",
      paidAt: "2026-10-12T17:00:00.000Z",
      requestedDate: "2026-10-12",
      requestedTime: null,
      items: [],
      totalAmount: 1200,
      trackingToken: "tk-38",
      cancellationReason: "Kitchen issue",
      notes: null,
      deliveryAddress: null,
      createdAt: "2026-10-12T17:00:00.000Z",
      updatedAt: "2026-10-12T17:15:00.000Z",
    },
    {
      id: "ord-6",
      businessId: "biz-1",
      orderNumber: 37,
      guestId: "g-6",
      guestName: "Arthur Dent",
      guestPhone: "+33633334444",
      serviceType: "pickup",
      channel: "whatsapp",
      status: "CANCELLED",
      paid: "refunded",
      paymentPreference: "wero",
      paymentMethod: "wero",
      paidAt: "2026-10-12T16:00:00.000Z",
      refundedAt: "2026-10-12T16:30:00.000Z",
      requestedDate: "2026-10-12",
      requestedTime: null,
      items: [],
      totalAmount: 800,
      trackingToken: "tk-37",
      cancellationReason: "Out of stock item",
      notes: null,
      deliveryAddress: null,
      createdAt: "2026-10-12T16:00:00.000Z",
      updatedAt: "2026-10-12T16:30:00.000Z",
    },
  ],
};

describe("OrderList Component", () => {
  it("renders status tabs with counts", () => {
    render(<OrderList now="2026-10-15T12:00:00.000Z" initialData={mockInitialData} />);
    expect(screen.getByTestId("tab-active").textContent).toContain("Active");
    expect(screen.getByTestId("tab-active").textContent).toContain("2");
    expect(screen.getByTestId("tab-completed").textContent).toContain("Completed");
    expect(screen.getByTestId("tab-completed").textContent).toContain("1");
    expect(screen.getByTestId("tab-cancelled").textContent).toContain("Cancelled");
    expect(screen.getByTestId("tab-cancelled").textContent).toContain("3");
  });

  it("shows active orders by default and highlights NEW orders", () => {
    render(<OrderList now="2026-10-15T12:00:00.000Z" initialData={mockInitialData} />);
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
    render(<OrderList now="2026-10-15T12:00:00.000Z" initialData={mockInitialData} />);
    fireEvent.mouseDown(screen.getByTestId("tab-completed"));

    expect(screen.getByTestId("order-card-ord-3")).toBeDefined();
    expect(screen.queryByTestId("order-card-ord-1")).toBeNull();
  });

  it("switches to cancelled tab and displays cancelled orders with refund due and refunded badges", () => {
    render(<OrderList now="2026-10-15T12:00:00.000Z" initialData={mockInitialData} />);
    fireEvent.mouseDown(screen.getByTestId("tab-cancelled"));

    expect(screen.getByTestId("order-card-ord-4")).toBeDefined();
    expect(screen.getByTestId("order-card-ord-5")).toBeDefined();
    expect(screen.getByTestId("order-card-ord-6")).toBeDefined();

    // ord-5 is CANCELLED and paid -> shows Refund Due
    expect(screen.getByTestId("order-card-ord-5").textContent).toContain("Refund Due");

    // ord-6 is CANCELLED and refunded -> shows Refunded
    expect(screen.getByTestId("order-card-ord-6").textContent).toContain("Refunded");

    // ord-4 is CANCELLED and unpaid -> shows Unpaid
    expect(screen.getByTestId("order-card-ord-4").textContent).toContain("Unpaid");

    expect(screen.queryByTestId("order-card-ord-1")).toBeNull();
  });

  it("moves between status tabs with the arrow keys", async () => {
    render(<OrderList now="2026-10-15T12:00:00.000Z" initialData={mockInitialData} />);
    const active = screen.getByTestId("tab-active");
    active.focus();
    fireEvent.keyDown(active, { key: "ArrowRight" });
    await waitFor(() =>
      expect(screen.getByTestId("tab-completed").getAttribute("aria-selected")).toBe("true"),
    );
  });

  it("filters active orders by unpaidOnly", () => {
    render(<OrderList now="2026-10-15T12:00:00.000Z" initialData={mockInitialData} />);
    const unpaidButton = screen.getByTestId("filter-unpaid");
    fireEvent.click(unpaidButton);

    // ord-1 is unpaid, ord-2 is paid
    expect(screen.getByTestId("order-card-ord-1")).toBeDefined();
    expect(screen.queryByTestId("order-card-ord-2")).toBeNull();
  });

  it("filters active orders by serviceType", () => {
    render(<OrderList now="2026-10-15T12:00:00.000Z" initialData={mockInitialData} />);
    fireEvent.click(screen.getByTestId("filter-service-delivery"));

    // ord-2 is delivery, ord-1 is pickup
    expect(screen.getByTestId("order-card-ord-2")).toBeDefined();
    expect(screen.queryByTestId("order-card-ord-1")).toBeNull();
  });

  it("searches orders by guest name or phone or order number", () => {
    render(<OrderList now="2026-10-15T12:00:00.000Z" initialData={mockInitialData} />);
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
    render(<OrderList now="2026-10-15T12:00:00.000Z" initialData={mockInitialData} />);
    const searchInput = screen.getByTestId("order-search-input");
    fireEvent.change(searchInput, { target: { value: "NonExistent" } });

    expect(screen.getByTestId("orders-empty-state")).toBeDefined();
    expect(screen.getByText("No orders found")).toBeDefined();
  });

  it("renders 'Accept' quick progress button for NEW orders", () => {
    render(<OrderList now="2026-10-15T12:00:00.000Z" initialData={mockInitialData} />);
    const acceptBtn = screen.getByTestId("quick-progress-ord-1");
    expect(acceptBtn.textContent).toContain("Accept");
  });

  it("displays submittedName mismatch badge and matches search on submittedName", () => {
    const dataWithMismatch: ListOrdersResult = {
      ...mockInitialData,
      orders: [
        { ...mockInitialData.orders[0], submittedName: "Marc" },
        ...mockInitialData.orders.slice(1),
      ],
    };
    render(<OrderList now="2026-10-15T12:00:00.000Z" initialData={dataWithMismatch} />);
    expect(screen.getByTestId("order-submitted-name-badge").textContent).toBe("Ordered as Marc");

    const searchInput = screen.getByTestId("order-search-input");
    fireEvent.change(searchInput, { target: { value: "Marc" } });
    expect(screen.getByTestId("order-card-ord-1")).toBeDefined();
  });

  it("reads due dates against 'now' on the business calendar (#168)", () => {
    const dueToday = {
      ...mockInitialData,
      orders: mockInitialData.orders.map((o) => ({
        ...o,
        status: "CONFIRMED" as const,
        requestedDate: "2026-10-14",
        requestedTime: "23:00",
      })),
    };
    // 22:30 UTC on 14 Oct is 00:30 on 15 Oct in Paris: due yesterday; in New York it is 18:30
    // on the 14th and the 23:00 deadline is still ahead
    const { unmount } = render(
      <BusinessTimeZoneProvider timeZone="Europe/Paris">
        <OrderList now="2026-10-14T22:30:00.000Z" initialData={dueToday} />
      </BusinessTimeZoneProvider>,
    );
    expect(screen.getAllByText("(-1d)").length).toBeGreaterThan(0);
    unmount();

    render(
      <BusinessTimeZoneProvider timeZone="America/New_York">
        <OrderList now="2026-10-14T22:30:00.000Z" initialData={dueToday} />
      </BusinessTimeZoneProvider>,
    );
    expect(screen.queryByText("(-1d)")).toBeNull();
    expect(screen.queryByText("(-overdue)")).toBeNull();
  });
});
