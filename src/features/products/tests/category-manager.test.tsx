import { getDictionary } from "@/domain/i18n";
import { demoCategories } from "@/lib/repositories/mock/fixtures";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CategoryManager } from "../components/category-manager";
import * as categoryActions from "../category-actions";

afterEach(() => {
  vi.clearAllMocks();
});

const mockCategories = [demoCategories[0], demoCategories[1]];

describe("CategoryManager component", () => {
  it("creates and edits roles and shows the saved role", async () => {
    vi.spyOn(categoryActions, "createCategoryAction").mockResolvedValueOnce({
      ok: true,
      data: { ...mockCategories[0], id: "new", name: "Juices", role: "drinks" },
    });
    vi.spyOn(categoryActions, "renameCategoryAction").mockResolvedValueOnce({
      ok: true,
      data: { ...mockCategories[0], role: "snacks" },
    });
    render(<CategoryManager initialCategories={mockCategories} />);
    fireEvent.change(screen.getByLabelText("New category name"), { target: { value: "Juices" } });
    fireEvent.change(screen.getByLabelText("Category role"), { target: { value: "drinks" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Category" }));
    await waitFor(() =>
      expect(categoryActions.createCategoryAction).toHaveBeenCalledWith({
        name: "Juices",
        role: "drinks",
      }),
    );
    await waitFor(() =>
      expect((screen.getByLabelText("Category role") as HTMLSelectElement).value).toBe("regular"),
    );
    fireEvent.click(screen.getByLabelText(`Rename ${mockCategories[0].name}`));
    fireEvent.change(screen.getByTestId(`edit-category-role-select-${mockCategories[0].id}`), {
      target: { value: "snacks" },
    });
    fireEvent.click(screen.getByLabelText("Save category name"));
    await waitFor(() =>
      expect(categoryActions.renameCategoryAction).toHaveBeenCalledWith({
        id: mockCategories[0].id,
        name: mockCategories[0].name,
        role: "snacks",
      }),
    );
    await waitFor(() => expect(screen.getByText("Snacks", { selector: "span" })).toBeDefined());
    fireEvent.click(screen.getByLabelText(`Rename ${mockCategories[0].name}`));
    expect(
      (screen.getByTestId(`edit-category-role-select-${mockCategories[0].id}`) as HTMLSelectElement)
        .value,
    ).toBe("snacks");
    fireEvent.click(screen.getByLabelText("Cancel editing"));
    expect(screen.queryByLabelText("Edit category name")).toBeNull();
  });
  it("renders French role labels", () => {
    render(
      <CategoryManager initialCategories={mockCategories} dict={getDictionary("fr").products} />,
    );
    expect(screen.getByLabelText("Rôle de la catégorie")).toBeDefined();
    expect(screen.getByRole("option", { name: "Boissons" })).toBeDefined();
  });
  it("renders initial categories list", () => {
    render(<CategoryManager initialCategories={mockCategories} />);

    expect(screen.getByText(mockCategories[0].name)).toBeDefined();
    expect(screen.getByText(mockCategories[1].name)).toBeDefined();
    expect(screen.getByText("Categories (2)")).toBeDefined();
  });

  it("creates a new category on form submit", async () => {
    vi.spyOn(categoryActions, "createCategoryAction").mockResolvedValueOnce({
      ok: true,
      data: {
        id: "22222222-2222-4222-8222-222222222203",
        businessId: "11111111-1111-4111-8111-111111111111",
        name: "Boissons",
        sortOrder: 3,
        role: "regular" as const,
        createdAt: "2026-08-01T08:00:00.000Z",
      },
    });

    render(<CategoryManager initialCategories={mockCategories} />);

    const input = screen.getByLabelText("New category name");
    fireEvent.change(input, { target: { value: "Boissons" } });

    const submitBtn = screen.getByRole("button", { name: /add category/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Boissons")).toBeDefined();
    });
  });

  it("displays error when creation fails", async () => {
    vi.spyOn(categoryActions, "createCategoryAction").mockResolvedValueOnce({
      ok: false,
      code: "INTERNAL",
      message: "A category with this name already exists",
    });

    render(<CategoryManager initialCategories={mockCategories} />);

    const input = screen.getByLabelText("New category name");
    fireEvent.change(input, { target: { value: mockCategories[0].name } });

    const submitBtn = screen.getByRole("button", { name: /add category/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeDefined();
    });
  });

  it("handles category renaming", async () => {
    vi.spyOn(categoryActions, "renameCategoryAction").mockResolvedValueOnce({
      ok: true,
      data: {
        id: "22222222-2222-4222-8222-222222222201",
        businessId: "11111111-1111-4111-8111-111111111111",
        name: "Grillades",
        sortOrder: 1,
        role: "regular" as const,
        createdAt: "2026-08-01T08:00:00.000Z",
      },
    });

    render(<CategoryManager initialCategories={mockCategories} />);

    const renameBtn = screen.getByLabelText(`Rename ${mockCategories[0].name}`);
    fireEvent.click(renameBtn);

    const editInput = screen.getByLabelText("Edit category name");
    fireEvent.change(editInput, { target: { value: "Grillades" } });

    const saveBtn = screen.getByLabelText("Save category name");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("Grillades")).toBeDefined();
    });
  });

  it("handles category deletion and displays error if non-empty", async () => {
    vi.spyOn(categoryActions, "deleteCategoryAction").mockResolvedValueOnce({
      ok: false,
      code: "INTERNAL",
      message: "Cannot delete category: 3 product(s) are assigned to it.",
    });

    render(<CategoryManager initialCategories={mockCategories} />);

    const deleteBtn = screen.getByLabelText(`Delete ${mockCategories[0].name}`);
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeDefined();
    });
  });

  it("renders In catalog status for categories with products and Unassigned for empty categories", () => {
    const categoriesWithCounts = [
      {
        ...mockCategories[0],
        productCount: 4,
      },
      {
        ...mockCategories[1],
        name: "Drinks",
        productCount: 0,
      },
    ];

    render(<CategoryManager initialCategories={categoriesWithCounts} />);

    // First category: in catalog, disabled delete
    expect(screen.getByText("4 products")).toBeDefined();
    expect(screen.getByText("In catalog")).toBeDefined();
    const firstDeleteBtn = screen.getByLabelText(
      new RegExp(`delete ${mockCategories[0].name}`, "i"),
    );
    expect(firstDeleteBtn.hasAttribute("disabled")).toBe(true);

    // Drinks: unassigned, enabled delete
    expect(screen.getByText("0 products")).toBeDefined();
    expect(screen.getByText("Unassigned")).toBeDefined();
    const drinksDeleteBtn = screen.getByLabelText("Delete Drinks");
    expect(drinksDeleteBtn.hasAttribute("disabled")).toBe(false);

    // Total counts in footer
    expect(screen.getByText("4 products total")).toBeDefined();
  });
});
