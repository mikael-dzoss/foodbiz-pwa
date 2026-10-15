import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ManageDashboardPage from "../(authenticated)/page";
import * as auth from "@/lib/auth";
import * as dashboardActions from "@/features/dashboard/dashboard-actions";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@/lib/auth", () => ({
  requireManagerSession: vi.fn(async () => ({
    user: {
      id: "00000000-0000-4000-8000-000000000002",
      email: "manager@test.com",
      name: "Manager",
      role: "manager",
      businessId: "11111111-1111-4111-8111-111111111111",
    },
    business: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Test Bakery",
      slug: "test-bakery",
      currency: "EUR",
    },
    expiresAt: "2099-01-01T00:00:00.000Z",
  })),
}));

vi.mock("@/features/dashboard/components/dashboard-view", () => ({
  DashboardView: ({ initialData }: { initialData: { periodPreset: string } }) => (
    <div data-testid="dashboard-view">Dashboard View - {initialData.periodPreset}</div>
  ),
}));

import { buildDashboardData } from "@/domain";

describe("ManageDashboardPage", () => {
  it("renders dashboard view with data loaded from getDashboardDataAction", async () => {
    vi.spyOn(dashboardActions, "getDashboardDataAction").mockResolvedValueOnce({
      success: true,
      data: buildDashboardData({
        orders: [],
        expenses: [],
        products: [],
        periodPreset: "last_7_days",
      }),
    });

    const jsx = await ManageDashboardPage({
      searchParams: Promise.resolve({ period: "last_7_days" }),
    });

    render(jsx);
    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("dashboard-view").textContent).toContain(
      "Dashboard View - last_7_days",
    );
  });

  it("handles fallback empty data when getDashboardDataAction fails", async () => {
    vi.spyOn(dashboardActions, "getDashboardDataAction").mockResolvedValueOnce({
      success: false,
      error: "Failed to load dashboard data",
    });

    const jsx = await ManageDashboardPage();

    render(jsx);
    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("dashboard-view").textContent).toContain("Dashboard View - today");
  });
});
