import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductsPage from "../(authenticated)/products/page";
import * as auth from "@/lib/auth";
import { DEMO_PRODUCT, demoBusiness, demoCategories } from "@/lib/repositories/mock/fixtures";

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
      name: "Test Shop",
      slug: "test-shop",
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
          ...DEMO_PRODUCT.chaudChaudNoyaux,
          categoryName: demoCategories[0].name,
        },
      ],
      categories: [demoCategories[0]],
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
    expect(demoBusiness.id).toBe("11111111-1111-4111-8111-111111111111");
    const page = await ProductsPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Products", level: 1 })).toBeDefined();
    expect(screen.getByText(DEMO_PRODUCT.chaudChaudNoyaux.name)).toBeDefined();
  });
});
