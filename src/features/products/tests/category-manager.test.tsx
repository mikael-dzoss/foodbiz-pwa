import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { CategoryManager } from "../components/category-manager";
import * as categoryActions from "../category-actions";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockCategories = [
  {
    id: "22222222-2222-4222-8222-222222222201",
    businessId: "11111111-1111-4111-8111-111111111111",
    name: "Breads",
    sortOrder: 1,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222202",
    businessId: "11111111-1111-4111-8111-111111111111",
    name: "Pastries",
    sortOrder: 2,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
];

describe("CategoryManager component", () => {
  it("renders initial categories list", () => {
    render(<CategoryManager initialCategories={mockCategories} />);

    expect(screen.getByText("Breads")).toBeDefined();
    expect(screen.getByText("Pastries")).toBeDefined();
    expect(screen.getByText("Categories (2)")).toBeDefined();
  });

  it("creates a new category on form submit", async () => {
    vi.spyOn(categoryActions, "createCategoryAction").mockResolvedValueOnce({
      success: true,
      data: {
        id: "22222222-2222-4222-8222-222222222203",
        businessId: "11111111-1111-4111-8111-111111111111",
        name: "Beverages",
        sortOrder: 3,
        createdAt: "2026-08-01T08:00:00.000Z",
      },
    });

    render(<CategoryManager initialCategories={mockCategories} />);

    const input = screen.getByLabelText("New category name");
    fireEvent.change(input, { target: { value: "Beverages" } });

    const submitBtn = screen.getByRole("button", { name: /add category/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Beverages")).toBeDefined();
    });
  });

  it("displays error when creation fails", async () => {
    vi.spyOn(categoryActions, "createCategoryAction").mockResolvedValueOnce({
      success: false,
      error: "A category with this name already exists",
    });

    render(<CategoryManager initialCategories={mockCategories} />);

    const input = screen.getByLabelText("New category name");
    fireEvent.change(input, { target: { value: "Breads" } });

    const submitBtn = screen.getByRole("button", { name: /add category/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("A category with this name already exists")).toBeDefined();
    });
  });

  it("handles category renaming", async () => {
    vi.spyOn(categoryActions, "renameCategoryAction").mockResolvedValueOnce({
      success: true,
      data: {
        id: "22222222-2222-4222-8222-222222222201",
        businessId: "11111111-1111-4111-8111-111111111111",
        name: "Artisan Breads",
        sortOrder: 1,
        createdAt: "2026-08-01T08:00:00.000Z",
      },
    });

    render(<CategoryManager initialCategories={mockCategories} />);

    const renameBtn = screen.getByLabelText("Rename Breads");
    fireEvent.click(renameBtn);

    const editInput = screen.getByLabelText("Edit category name");
    fireEvent.change(editInput, { target: { value: "Artisan Breads" } });

    const saveBtn = screen.getByLabelText("Save category name");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("Artisan Breads")).toBeDefined();
    });
  });

  it("handles category deletion and displays error if non-empty", async () => {
    vi.spyOn(categoryActions, "deleteCategoryAction").mockResolvedValueOnce({
      success: false,
      error: "Cannot delete category: 3 product(s) are assigned to it.",
    });

    render(<CategoryManager initialCategories={mockCategories} />);

    const deleteBtn = screen.getByLabelText("Delete Breads");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Cannot delete category: 3 product(s) are assigned to it."),
      ).toBeDefined();
    });
  });

  it("renders In catalog status for categories with products and Unassigned for empty categories", () => {
    const categoriesWithCounts = [
      {
        ...mockCategories[0],
        name: "Breads",
        productCount: 4,
      },
      {
        ...mockCategories[1],
        name: "Drinks",
        productCount: 0,
      },
    ];

    render(<CategoryManager initialCategories={categoriesWithCounts} />);

    // Breads: in catalog, disabled delete
    expect(screen.getByText("4 products")).toBeDefined();
    expect(screen.getByText("In catalog")).toBeDefined();
    const breadsDeleteBtn = screen.getByLabelText(/delete breads/i);
    expect(breadsDeleteBtn.hasAttribute("disabled")).toBe(true);

    // Drinks: unassigned, enabled delete
    expect(screen.getByText("0 products")).toBeDefined();
    expect(screen.getByText("Unassigned")).toBeDefined();
    const drinksDeleteBtn = screen.getByLabelText("Delete Drinks");
    expect(drinksDeleteBtn.hasAttribute("disabled")).toBe(false);

    // Total counts in footer
    expect(screen.getByText("4 products total")).toBeDefined();
  });
});
