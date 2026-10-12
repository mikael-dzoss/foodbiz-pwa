import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ProductManager } from "../components/product-manager";
import type { EnrichedProduct } from "../product-actions";
import type { ProductCategory } from "@/domain";

const mockAdjustProductStockAction = vi.fn();
const mockToggleProductVisibilityAction = vi.fn();

vi.mock("../product-actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../product-actions")>();
  return {
    ...actual,
    adjustProductStockAction: (...args: unknown[]) => mockAdjustProductStockAction(...args),
    toggleProductVisibilityAction: (...args: unknown[]) =>
      mockToggleProductVisibilityAction(...args),
  };
});

const sampleCategories: ProductCategory[] = [
  {
    id: "cat-1",
    businessId: "biz-1",
    name: "Plats",
    sortOrder: 1,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: "cat-2",
    businessId: "biz-1",
    name: "Desserts",
    sortOrder: 2,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
];

const sampleProducts: EnrichedProduct[] = [
  {
    id: "prod-1",
    businessId: "biz-1",
    categoryId: "cat-1",
    categoryName: "Plats",
    name: "Burger Gourmet",
    description: "Tasty burger",
    price: 1250,
    unitCost: 420,
    stock: 18,
    visible: true,
    imageUrl: "/images/burger.jpg",
    createdAt: "2026-08-01T08:00:00.000Z",
    updatedAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: "prod-2",
    businessId: "biz-1",
    categoryId: "cat-2",
    categoryName: "Desserts",
    name: "Tiramisu Maison",
    description: "Sweet dessert",
    price: 500,
    unitCost: 180,
    stock: 3,
    visible: true,
    imageUrl: null,
    createdAt: "2026-08-01T08:00:00.000Z",
    updatedAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: "prod-3",
    businessId: "biz-1",
    categoryId: "cat-1",
    categoryName: "Plats",
    name: "Seasonal Special",
    description: "Hidden secret dish",
    price: 1500,
    unitCost: 500,
    stock: 0,
    visible: false,
    imageUrl: null,
    createdAt: "2026-08-01T08:00:00.000Z",
    updatedAt: "2026-08-01T08:00:00.000Z",
  },
];

describe("ProductManager Component (Screen M-40)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdjustProductStockAction.mockResolvedValue({ success: true });
    mockToggleProductVisibilityAction.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders products list with search, filter chips, and badges", () => {
    render(
      <ProductManager
        initialProducts={sampleProducts}
        categories={sampleCategories}
        lowStockThreshold={5}
      />,
    );

    // Header & counters
    expect(screen.getByRole("heading", { name: "Products" })).toBeDefined();
    expect(screen.getByText("Burger Gourmet")).toBeDefined();
    expect(screen.getByText("Tiramisu Maison")).toBeDefined();
    expect(screen.getByText("Seasonal Special")).toBeDefined();

    // Stock pills
    expect(screen.getByText("18 in stock")).toBeDefined();
    expect(screen.getByText("3 left")).toBeDefined(); // low stock <= 5
    expect(screen.getByText("0 in stock")).toBeDefined(); // out of stock

    // Visibility badges
    expect(screen.getAllByText("Visible")).toHaveLength(2);
    expect(screen.getByText("Hidden")).toBeDefined();
  });

  it("filters products by search query", () => {
    render(
      <ProductManager
        initialProducts={sampleProducts}
        categories={sampleCategories}
        lowStockThreshold={5}
      />,
    );

    const searchInput = screen.getByTestId("product-search-input");
    fireEvent.change(searchInput, { target: { value: "Tiramisu" } });

    expect(screen.getByText("Tiramisu Maison")).toBeDefined();
    expect(screen.queryByText("Burger Gourmet")).toBeNull();
    expect(screen.queryByText("Seasonal Special")).toBeNull();
  });

  it("filters products by category chip and status chips", () => {
    render(
      <ProductManager
        initialProducts={sampleProducts}
        categories={sampleCategories}
        lowStockThreshold={5}
      />,
    );

    // Click Desserts chip
    const dessertsChip = screen.getByRole("tab", { name: /Desserts/i });
    fireEvent.click(dessertsChip);

    expect(screen.getByText("Tiramisu Maison")).toBeDefined();
    expect(screen.queryByText("Burger Gourmet")).toBeNull();

    // Click Low Stock chip
    const lowStockChip = screen.getByRole("tab", { name: /Low Stock/i });
    fireEvent.click(lowStockChip);
    expect(screen.getByText("Tiramisu Maison")).toBeDefined();
    expect(screen.queryByText("Burger Gourmet")).toBeNull();

    // Click Hidden chip
    const hiddenChip = screen.getByRole("tab", { name: /Hidden/i });
    fireEvent.click(hiddenChip);
    expect(screen.getByText("Seasonal Special")).toBeDefined();
    expect(screen.queryByText("Burger Gourmet")).toBeNull();
  });

  it("shows no-results state when search query doesn't match", () => {
    render(<ProductManager initialProducts={sampleProducts} categories={sampleCategories} />);

    const searchInput = screen.getByTestId("product-search-input");
    fireEvent.change(searchInput, { target: { value: "NonExistentPizza" } });

    expect(screen.getByTestId("no-results-products")).toBeDefined();
    expect(screen.getByText("Clear filters")).toBeDefined();

    // Clear filters restores list
    fireEvent.click(screen.getByText("Clear filters"));
    expect(screen.getByText("Burger Gourmet")).toBeDefined();
  });

  it("shows empty state when no products exist", () => {
    render(<ProductManager initialProducts={[]} categories={sampleCategories} />);

    expect(screen.getByTestId("empty-products")).toBeDefined();
    expect(screen.getByText("No products yet")).toBeDefined();
  });

  it("handles quick stock increment and decrement", async () => {
    render(<ProductManager initialProducts={sampleProducts} categories={sampleCategories} />);

    const plusBtn = screen.getByTestId("quick-stock-plus-prod-1");
    fireEvent.click(plusBtn);

    expect(mockAdjustProductStockAction).toHaveBeenCalledWith("prod-1", 19);

    const minusBtn = screen.getByTestId("quick-stock-minus-prod-1");
    fireEvent.click(minusBtn);

    expect(mockAdjustProductStockAction).toHaveBeenCalledWith("prod-1", 18);
  });

  it("handles quick visibility toggle (soft delete / hide)", async () => {
    render(<ProductManager initialProducts={sampleProducts} categories={sampleCategories} />);

    const toggleBtn = screen.getByTestId("toggle-visibility-prod-1");
    fireEvent.click(toggleBtn);

    expect(mockToggleProductVisibilityAction).toHaveBeenCalledWith("prod-1", false);
  });

  it("opens product form sheet on Add Product click", () => {
    render(<ProductManager initialProducts={sampleProducts} categories={sampleCategories} />);

    const addBtn = screen.getByTestId("add-product-button");
    fireEvent.click(addBtn);

    expect(screen.getByTestId("product-form-sheet")).toBeDefined();
  });

  it("opens stock adjustment sheet on stock adjust trigger", () => {
    render(<ProductManager initialProducts={sampleProducts} categories={sampleCategories} />);

    const stockCountBtn = screen.getByTestId("quick-stock-count-prod-1");
    fireEvent.click(stockCountBtn);

    expect(screen.getByTestId("stock-adjustment-sheet")).toBeDefined();
  });
});
