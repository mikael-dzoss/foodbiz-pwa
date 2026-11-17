import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DashboardView } from "../components/dashboard-view";
import type { DashboardData } from "@/domain";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockData: DashboardData = {
  periodPreset: "today",
  period: { startDate: "2026-10-15", endDate: "2026-10-15" },
  kpis: {
    period: { startDate: "2026-10-15", endDate: "2026-10-15" },
    previousPeriod: { startDate: "2026-10-14", endDate: "2026-10-14" },
    current: {
      revenue: 42000,
      pendingRevenue: 0,
      totalPendingRevenue: 0,
      costs: 14500,
      profit: 27500,
      paidOrderCount: 18,
      completedOrderCount: 18,
      cancelledOrderCount: 0,
      totalClosedOrderCount: 18,
      averageOrderValue: 2333,
    },
    previous: {
      revenue: 37333,
      pendingRevenue: 0,
      totalPendingRevenue: 0,
      costs: 15300,
      profit: 22033,
      paidOrderCount: 15,
      completedOrderCount: 15,
      cancelledOrderCount: 0,
      totalClosedOrderCount: 15,
      averageOrderValue: 2241,
    },
    deltas: {
      revenue: { absolute: 4667, percentage: 12.5 },
      pendingRevenue: { absolute: 0, percentage: 0 },
      costs: { absolute: -800, percentage: -5.2 },
      profit: { absolute: 5467, percentage: 24.0 },
      paidOrderCount: { absolute: 3, percentage: 20.0 },
      completedOrderCount: { absolute: 3, percentage: 20.0 },
      cancelledOrderCount: { absolute: 0, percentage: 0 },
      totalClosedOrderCount: { absolute: 3, percentage: 20.0 },
      averageOrderValue: { absolute: 92, percentage: 4.1 },
    },
  },
  triage: {
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
      ],
    },
    unpaid: {
      count: 1,
      totalAmount: 3600,
      items: [
        {
          id: "u-1",
          orderNumber: 1043,
          guestName: "Bob",
          totalAmount: 3600,
          requestedDate: "2026-10-15",
          createdAt: "2026-10-15T11:00:00.000Z",
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
  },
  activity: [
    {
      id: "o-1",
      type: "order",
      title: "Order #1042",
      subtitle: "Alice · Paid",
      amount: 2400,
      timestamp: "2026-10-15T10:00:00.000Z",
      statusLabel: "Paid",
      statusVariant: "paid",
      href: "/manage/orders/o-1",
    },
  ],
};

describe("DashboardView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders screen header, active status, period picker and all 5 KPI cards", () => {
    render(<DashboardView initialData={mockData} />);

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeDefined();
    expect(screen.getByText("Today at a glance")).toBeDefined();
    expect(screen.getByText("Active")).toBeDefined();

    // Period tabs
    expect(screen.getByTestId("period-tab-today")).toBeDefined();
    expect(screen.getByTestId("period-tab-last_7_days")).toBeDefined();
    expect(screen.getByTestId("period-tab-last_30_days")).toBeDefined();
    expect(screen.getByTestId("period-tab-this_month")).toBeDefined();

    // KPI Cards
    const revCard = screen.getByTestId("kpi-revenue");
    expect(revCard.textContent).toContain("€420.00");
    expect(revCard.textContent).toContain("+12.5%");

    const costCard = screen.getByTestId("kpi-costs");
    expect(costCard.textContent).toContain("€145.00");
    expect(costCard.textContent).toContain("+5.2%"); // Math.abs on delta percentage

    const profitCard = screen.getByTestId("kpi-profit");
    expect(profitCard.textContent).toContain("€275.00");
    expect(profitCard.textContent).toContain("+24%");

    const ordersCard = screen.getByTestId("kpi-orders");
    expect(ordersCard.textContent).toContain("18");
    expect(ordersCard.textContent).toContain("+20%");

    const aovCard = screen.getByTestId("kpi-average-order-value");
    expect(aovCard.textContent).toContain("€23.33");
    expect(aovCard.textContent).toContain("+4.1%");
  });

  it("switches period through the URL so the server re-renders with fresh data", async () => {
    render(<DashboardView initialData={mockData} />);

    fireEvent.click(screen.getByTestId("period-tab-last_7_days"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/manage?period=last_7_days");
    });
  });

  it("renders translated French strings when locale='fr'", () => {
    render(<DashboardView initialData={mockData} locale="fr" />);

    expect(screen.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeDefined();
    expect(screen.getByText("Aperçu de la journée")).toBeDefined();
    expect(screen.getByText("Actif")).toBeDefined();
    expect(screen.getByText("Aujourd'hui")).toBeDefined();
    expect(screen.getByText("7 jours")).toBeDefined();
    expect(screen.getByText("Chiffre d'affaires")).toBeDefined();
    expect(screen.getByText("Bénéfice net")).toBeDefined();
  });
});
