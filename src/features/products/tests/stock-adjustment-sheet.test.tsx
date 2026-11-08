import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StockAdjustmentSheet } from "../components/stock-adjustment-sheet";
import type { EnrichedProduct } from "../product-actions";

const mockAdjustProductStockAction = vi.fn();

vi.mock("../product-actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../product-actions")>();
  return {
    ...actual,
    adjustProductStockAction: (...args: unknown[]) => mockAdjustProductStockAction(...args),
  };
});

const sampleProduct: EnrichedProduct = {
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
  imageUrl: null,
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-01T08:00:00.000Z",
};

describe("StockAdjustmentSheet Component (Screen M-43)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdjustProductStockAction.mockResolvedValue({ success: true });
  });

  it("renders stock summary and controls when open", () => {
    render(
      <StockAdjustmentSheet
        product={sampleProduct}
        isOpen={true}
        onOpenChange={() => {}}
        lowStockThreshold={5}
      />,
    );

    expect(screen.getByRole("heading", { name: "Adjust Stock" })).toBeDefined();
    expect(screen.getByText("Burger Gourmet · Plats")).toBeDefined();
    expect(screen.getByTestId("target-stock-display").textContent).toBe("18");
    expect(screen.getByText("Difference: +0 units")).toBeDefined();
    expect(screen.getByText("Restock / Delivery")).toBeDefined();
  });

  it("adjusts target stock via quick delta chips and prevents negative stock", () => {
    render(<StockAdjustmentSheet product={sampleProduct} isOpen={true} onOpenChange={() => {}} />);

    // Click +5 chip
    const plus5Btn = screen.getByRole("button", { name: "+5" });
    fireEvent.click(plus5Btn);
    expect(screen.getByTestId("target-stock-display").textContent).toBe("23");
    expect(screen.getByText("Difference: +5 units")).toBeDefined();

    // Click -10 chip twice: 23 - 10 = 13, 13 - 10 = 3
    const minus10Btn = screen.getByRole("button", { name: "-10" });
    fireEvent.click(minus10Btn);
    expect(screen.getByTestId("target-stock-display").textContent).toBe("13");
    fireEvent.click(minus10Btn);
    expect(screen.getByTestId("target-stock-display").textContent).toBe("3");

    // Click -10 again: 3 - 10 -> clamped to 0
    fireEvent.click(minus10Btn);
    expect(screen.getByTestId("target-stock-display").textContent).toBe("0");
    expect(screen.getByText("Difference: -18 units")).toBeDefined();
  });

  it("adjusts target stock via direct number input", () => {
    render(<StockAdjustmentSheet product={sampleProduct} isOpen={true} onOpenChange={() => {}} />);

    const input = screen.getByTestId("direct-stock-input");
    fireEvent.change(input, { target: { value: "35" } });

    expect(screen.getByTestId("target-stock-display").textContent).toBe("35");
    expect(screen.getByText("Difference: +17 units")).toBeDefined();
  });

  it("calls adjustProductStockAction on update confirmation", async () => {
    const handleStockAdjusted = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <StockAdjustmentSheet
        product={sampleProduct}
        isOpen={true}
        onOpenChange={handleOpenChange}
        onStockAdjusted={handleStockAdjusted}
      />,
    );

    // Increment +1
    fireEvent.click(screen.getByRole("button", { name: "+1" }));

    // Click Update Stock
    const saveBtn = screen.getByTestId("confirm-stock-update");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockAdjustProductStockAction).toHaveBeenCalledWith("prod-1", 19, "Restock / Delivery");
      expect(handleStockAdjusted).toHaveBeenCalledWith("prod-1", 19);
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
