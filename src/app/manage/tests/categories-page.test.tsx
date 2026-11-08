import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoriesPage from "../(authenticated)/categories/page";
import * as auth from "@/lib/auth";

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

vi.mock("@/features/products/category-actions", () => ({
  listCategoriesAction: vi.fn(async () => ({
    success: true,
    data: [
      {
        id: "22222222-2222-4222-8222-222222222201",
        businessId: "11111111-1111-4111-8111-111111111111",
        name: "Breads",
        sortOrder: 1,
        createdAt: "2026-08-01T08:00:00.000Z",
      },
    ],
  })),
  createCategoryAction: vi.fn(),
  renameCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
}));

describe("CategoriesPage", () => {
  it("renders page header and initial categories", async () => {
    const page = await CategoriesPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Categories", level: 1 })).toBeDefined();
    expect(screen.getByText("Breads")).toBeDefined();
  });
});
