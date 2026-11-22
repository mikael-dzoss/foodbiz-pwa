import { describe, expect, it, vi, beforeEach } from "vitest";
import AuthenticatedManageLayout from "../(authenticated)/layout";
import ManageDashboardPage from "../(authenticated)/page";
import * as auth from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  requireManagerSession: vi.fn(),
}));

import { buildDashboardData, MOCK_MANAGER_SESSION } from "@/domain";

vi.mock("@/features/dashboard/dashboard-data", () => ({
  getDashboardData: vi.fn(async () =>
    buildDashboardData({
      orders: [],
      expenses: [],
      products: [],
      periodPreset: "today",
      now: new Date("2026-10-15T12:00:00Z"),
      timeZone: "UTC",
    }),
  ),
}));

vi.mock("@/features/dashboard", () => ({
  DashboardView: () => null,
}));

describe("manage: route guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("layout calls requireManagerSession to protect all child routes", async () => {
    vi.mocked(auth.requireManagerSession).mockResolvedValue({
      ...MOCK_MANAGER_SESSION,
      user: { ...MOCK_MANAGER_SESSION.user, role: "manager" },
    });

    const jsx = await AuthenticatedManageLayout({
      children: "dashboard-content",
    });
    expect(auth.requireManagerSession).toHaveBeenCalledTimes(1);
    expect(jsx).toBeDefined();
  });

  it("page re-checks session on the server", async () => {
    vi.mocked(auth.requireManagerSession).mockResolvedValue({
      ...MOCK_MANAGER_SESSION,
      user: { ...MOCK_MANAGER_SESSION.user, role: "manager" },
    });

    const jsx = await ManageDashboardPage();
    expect(auth.requireManagerSession).toHaveBeenCalledTimes(1);
    expect(jsx).toBeDefined();
  });
});
