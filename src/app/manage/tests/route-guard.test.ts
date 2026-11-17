import { describe, expect, it, vi, beforeEach } from "vitest";
import AuthenticatedManageLayout from "../(authenticated)/layout";
import ManageDashboardPage from "../(authenticated)/page";
import * as auth from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  requireManagerSession: vi.fn(),
}));

import { buildDashboardData } from "@/domain";

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
      user: {
        id: "00000000-0000-4000-8000-000000000002",
        email: "manager@lapetiteboulangerie.fr",
        name: "Marie Dupont",
        role: "manager",
        businessId: "11111111-1111-4111-8111-111111111111",
      },
      business: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "La Petite Boulangerie",
        slug: "la-petite-boulangerie",
        currency: "EUR",
      },
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    const jsx = await AuthenticatedManageLayout({
      children: "dashboard-content",
    });
    expect(auth.requireManagerSession).toHaveBeenCalledTimes(1);
    expect(jsx).toBeDefined();
  });

  it("page re-checks session on the server", async () => {
    vi.mocked(auth.requireManagerSession).mockResolvedValue({
      user: {
        id: "00000000-0000-4000-8000-000000000002",
        email: "manager@lapetiteboulangerie.fr",
        name: "Marie Dupont",
        role: "manager",
        businessId: "11111111-1111-4111-8111-111111111111",
      },
      business: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "La Petite Boulangerie",
        slug: "la-petite-boulangerie",
        currency: "EUR",
      },
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    const jsx = await ManageDashboardPage();
    expect(auth.requireManagerSession).toHaveBeenCalledTimes(1);
    expect(jsx).toBeDefined();
  });
});
