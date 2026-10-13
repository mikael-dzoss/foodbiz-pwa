import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ProductsPage from "../(authenticated)/products/page";
import * as auth from "@/lib/auth";

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

vi.mock("@/features/products/product-actions", () => ({
  listProductsAction: vi.fn(async () => ({
    success: true,
    data: {
      products: [
        {
          id: "33333333-3333-4333-8333-333333333301",
          businessId: "11111111-1111-4111-8111-111111111111",
          categoryId: "22222222-2222-4222-8222-222222222201",
          categoryName: "Breads",
          name: "Traditional Baguette",
          description: "Crispy crust baguette",
          price: 130,
          unitCost: 35,
          stock: 45,
          visible: true,
          imageUrl: null,
          createdAt: "2026-08-01T08:00:00.000Z",
          updatedAt: "2026-08-01T08:00:00.000Z",
        },
      ],
      categories: [
        {
          id: "22222222-2222-4222-8222-222222222201",
          businessId: "11111111-1111-4111-8111-111111111111",
          name: "Breads",
          sortOrder: 1,
          createdAt: "2026-08-01T08:00:00.000Z",
        },
      ],
      lowStockThreshold: 5,
    },
  })),
  adjustProductStockAction: vi.fn(),
  toggleProductVisibilityAction: vi.fn(),
  createProductAction: vi.fn(),
  updateProductAction: vi.fn(),
}));

describe("ProductsPage (Screen M-40)", () => {
  it("authenticates manager session and renders product manager", async () => {
    const page = await ProductsPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Products", level: 1 })).toBeDefined();
    expect(screen.getByText("Traditional Baguette")).toBeDefined();
  });
});
