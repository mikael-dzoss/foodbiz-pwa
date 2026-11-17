import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ManageDashboardPage from "../(authenticated)/page";
import * as auth from "@/lib/auth";
import * as dashboardData from "@/features/dashboard/dashboard-data";

afterEach(() => {
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
  it("renders dashboard view with data loaded from getDashboardData", async () => {
    const spy = vi.spyOn(dashboardData, "getDashboardData").mockResolvedValueOnce(
      buildDashboardData({
        orders: [],
        expenses: [],
        products: [],
        periodPreset: "last_7_days",
      }),
    );

    const jsx = await ManageDashboardPage({
      searchParams: Promise.resolve({ period: "last_7_days" }),
    });

    render(jsx);
    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith("last_7_days");
    expect(screen.getByTestId("dashboard-view").textContent).toContain(
      "Dashboard View - last_7_days",
    );
  });

  it("defaults to today for a missing or invalid period", async () => {
    const spy = vi
      .spyOn(dashboardData, "getDashboardData")
      .mockResolvedValue(
        buildDashboardData({ orders: [], expenses: [], products: [], periodPreset: "today" }),
      );

    await ManageDashboardPage();
    await ManageDashboardPage({ searchParams: Promise.resolve({ period: "bogus" }) });
    expect(spy).toHaveBeenNthCalledWith(1, "today");
    expect(spy).toHaveBeenNthCalledWith(2, "today");
  });

  it("lets a read failure reach the route error boundary instead of rendering empty data", async () => {
    vi.spyOn(dashboardData, "getDashboardData").mockRejectedValueOnce(new Error("Offline"));
    await expect(ManageDashboardPage()).rejects.toThrow("Offline");
  });
});
