import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { OperationalWidgets } from "../components/operational-widgets";
import type { OperationalTriage } from "@/domain";

const mockTriage: OperationalTriage = {
  toPrepare: {
    count: 2,
    items: [
      {
        id: "o-1",
        orderNumber: 1042,
        guestName: "Alice",
        status: "PREPARING",
        totalAmount: 2400,
        itemCount: 2,
        itemsSummary: "2x Smash Burger",
        requestedDate: "2026-10-15",
        requestedTime: "12:30",
        createdAt: "2026-10-15T10:00:00.000Z",
      },
      {
        id: "o-2",
        orderNumber: 1043,
        guestName: "Bob",
        status: "CONFIRMED",
        totalAmount: 1800,
        itemCount: 1,
        itemsSummary: "1x Caesar Salad",
        requestedDate: "2026-10-15",
        requestedTime: "12:45",
        createdAt: "2026-10-15T10:15:00.000Z",
      },
    ],
  },
  unpaid: {
    count: 2,
    totalAmount: 5450,
    items: [
      {
        id: "u-1",
        orderNumber: 1042,
        guestName: "Alice",
        totalAmount: 2400,
        requestedDate: "2026-10-15",
        createdAt: "2026-10-15T10:00:00.000Z",
      },
    ],
  },
  lowStock: {
    count: 1,
    items: [
      {
        id: "p-1",
        name: "Brioche Buns",
        stock: 4,
        price: 350,
        unitCost: 100,
        status: "low_stock",
      },
    ],
  },
};

describe("OperationalWidgets Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders 'To prepare' orders count and preview list linking to orders", () => {
    render(<OperationalWidgets triage={mockTriage} />);

    const toPrepareWidget = screen.getByTestId("widget-to-prepare");
    expect(toPrepareWidget).toBeDefined();
    expect(within(toPrepareWidget).getByText("To prepare")).toBeDefined();
    expect(within(toPrepareWidget).getByText(/2 orders/)).toBeDefined();
    expect(within(toPrepareWidget).getByText(/2x Smash Burger/)).toBeDefined();
    expect(within(toPrepareWidget).getByText(/1x Caesar Salad/)).toBeDefined();

    const orderLink = screen.getByTestId("to-prepare-order-o-1");
    expect(orderLink.getAttribute("href")).toBe("/manage/orders/o-1");
  });

  it("renders 'Unpaid' count and amount linking to filtered orders", () => {
    render(<OperationalWidgets triage={mockTriage} />);

    expect(screen.getByTestId("widget-unpaid-orders")).toBeDefined();
    expect(screen.getByText("Unpaid orders")).toBeDefined();
    expect(screen.getByText(/2 unpaid · €54.50/)).toBeDefined();

    const reviewLink = screen.getByTestId("link-review-unpaid-orders");
    expect(reviewLink.getAttribute("href")).toBe("/manage/orders?unpaid=true");
  });

  it("renders low-stock products linking to product detail", () => {
    render(<OperationalWidgets triage={mockTriage} />);

    expect(screen.getByTestId("widget-low-stock")).toBeDefined();
    expect(screen.getByText("Low stock alert")).toBeDefined();
    expect(screen.getByText("Brioche Buns")).toBeDefined();
    expect(screen.getByText(/Only 4 left in kitchen/)).toBeDefined();

    const productLink = screen.getByTestId("low-stock-product-p-1");
    expect(productLink.getAttribute("href")).toBe("/manage/products/p-1");
  });

  it("renders healthy empty states when all queues are clear", () => {
    const emptyTriage: OperationalTriage = {
      toPrepare: { count: 0, items: [] },
      unpaid: { count: 0, totalAmount: 0, items: [] },
      lowStock: { count: 0, items: [] },
    };

    render(<OperationalWidgets triage={emptyTriage} />);

    expect(screen.getByText("No orders to prepare right now")).toBeDefined();
    expect(screen.getByText("All orders are paid")).toBeDefined();
    expect(screen.getByText("All inventory is well-stocked")).toBeDefined();
  });
});
