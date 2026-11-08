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
    id: "cat-2",
    businessId: "biz-1",
    name: "Desserts",
    sortOrder: 2,
    role: "regular" as const,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: "cat-1",
    businessId: "biz-1",
    name: "Plats",
    sortOrder: 1,
    role: "regular" as const,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: "cat-3",
    businessId: "biz-1",
    name: "Drinks",
    sortOrder: 3,
    role: "drinks" as const,
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
    allergens: [],
    suggestAddOns: true,
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
    allergens: [],
    suggestAddOns: true,
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
    allergens: [],
    suggestAddOns: true,
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

  it("groups products under category section titles sorted by sortOrder and hides empty groups (#205)", () => {
    render(
      <ProductManager
        initialProducts={sampleProducts}
        categories={sampleCategories}
        lowStockThreshold={5}
      />,
    );

    // Category section headings are sorted by sortOrder (Plats sortOrder 1, Desserts sortOrder 2)
    // and empty category (Drinks sortOrder 3) is hidden
    const platsHeading = screen.getByRole("heading", { level: 2, name: "Plats" });
    const dessertsHeading = screen.getByRole("heading", { level: 2, name: "Desserts" });
    expect(dessertsHeading.getAttribute("id")).toBe("category-heading-cat-2");
    expect(screen.queryByRole("heading", { level: 2, name: "Drinks" })).toBeNull();

    expect(platsHeading.getAttribute("id")).toBe("category-heading-cat-1");
    expect(platsHeading.getAttribute("tabindex")).toBe("-1");
    expect(platsHeading.className).toContain("scroll-mt-");

    const sections = screen
      .getAllByRole("region")
      .filter((el) => el.id.startsWith("category-section-"));
    expect(sections.map((s) => s.id)).toEqual(["category-section-cat-1", "category-section-cat-2"]);

    // Section counts reflect products in each group
    expect(screen.getByTestId("category-count-cat-1").textContent).toContain("2");
    expect(screen.getByTestId("category-count-cat-2").textContent).toContain("1");
  });

  it("replaces per-category filter chips with sticky CategoryNav and jumps to section on select (#205)", () => {
    const scrollIntoViewMock = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(
      <ProductManager
        initialProducts={sampleProducts}
        categories={sampleCategories}
        lowStockThreshold={5}
      />,
    );

    // Per-category filter tabs are removed; status filter tabs remain
    expect(screen.queryByRole("tab", { name: /Plats/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Desserts/i })).toBeNull();
    expect(screen.getByRole("tab", { name: /All/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Low Stock/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Hidden/i })).toBeDefined();

    // CategoryNav shows tabs for non-empty categories only
    expect(screen.getByTestId("category-nav-tab-cat-1")).toBeDefined();
    expect(screen.getByTestId("category-nav-tab-cat-2")).toBeDefined();
    expect(screen.queryByTestId("category-nav-tab-cat-3")).toBeNull();

    // Selecting a CategoryNav tab scrolls to and focuses the category heading
    scrollIntoViewMock.mockClear();
    fireEvent.click(screen.getByTestId("category-nav-tab-cat-2"));
    const dessertsHeading = screen.getByRole("heading", { level: 2, name: "Desserts" });
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(document.activeElement).toBe(dessertsHeading);

    // Status filter chips still filter sections and update CategoryNav items
    const lowStockChip = screen.getByRole("tab", { name: /Low Stock/i });
    fireEvent.click(lowStockChip);
    expect(screen.getByText("Tiramisu Maison")).toBeDefined();
    expect(screen.queryByText("Burger Gourmet")).toBeNull();
    expect(screen.queryByTestId("category-nav-tab-cat-1")).toBeNull();
    expect(screen.getByTestId("category-nav-tab-cat-2")).toBeDefined();

    // Hidden chip filters to hidden items and updates CategoryNav items
    const hiddenChip = screen.getByRole("tab", { name: /Hidden/i });
    fireEvent.click(hiddenChip);
    expect(screen.getByText("Seasonal Special")).toBeDefined();
    expect(screen.queryByText("Tiramisu Maison")).toBeNull();
    expect(screen.getByTestId("category-nav-tab-cat-1")).toBeDefined();
    expect(screen.queryByTestId("category-nav-tab-cat-2")).toBeNull();

    // All chip restores all categories
    fireEvent.click(screen.getByRole("tab", { name: /All/i }));
    expect(screen.getByTestId("category-nav-tab-cat-1")).toBeDefined();
    expect(screen.getByTestId("category-nav-tab-cat-2")).toBeDefined();

    // Selecting a category via the CategoryNav Menu sheet scrolls and focuses heading
    scrollIntoViewMock.mockClear();
    fireEvent.click(screen.getByTestId("category-nav-menu-button"));
    fireEvent.click(screen.getByTestId("category-nav-sheet-item-cat-1"));
    const platsHeading = screen.getByRole("heading", { level: 2, name: "Plats" });
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(document.activeElement).toBe(platsHeading);
  });

  it("groups products with unknown categoryId under Uncategorized", () => {
    const uncategorizedProduct: EnrichedProduct = {
      ...sampleProducts[0]!,
      id: "prod-uncat",
      categoryId: "cat-missing",
      categoryName: "Unknown",
      name: "Mystery Box",
    };

    render(
      <ProductManager
        initialProducts={[uncategorizedProduct]}
        categories={sampleCategories}
        lowStockThreshold={5}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Uncategorized" })).toBeDefined();
    expect(screen.getByTestId("category-nav-tab-uncategorized")).toBeDefined();
    expect(screen.getByText("Mystery Box")).toBeDefined();
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
