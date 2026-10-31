import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ProductFormSheet } from "../components/product-form-sheet";
import { getDictionary } from "@/domain/i18n";
import type { ProductCategory } from "@/domain";
import type { EnrichedProduct } from "../product-actions";

const mockCreateProductAction = vi.fn();
const mockUpdateProductAction = vi.fn();
const mockUploadProductImageAction = vi.fn();

vi.mock("../product-actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../product-actions")>();
  return {
    ...actual,
    createProductAction: (...args: unknown[]) => mockCreateProductAction(...args),
    updateProductAction: (...args: unknown[]) => mockUpdateProductAction(...args),
    uploadProductImageAction: (...args: unknown[]) => mockUploadProductImageAction(...args),
  };
});

vi.mock("../utils/image-compression", () => ({
  compressImageFile: vi.fn(async () => ({
    dataUrl: "data:image/jpeg;base64,mockedcompressedpayload",
    width: 800,
    height: 800,
    sizeBytes: 1024,
  })),
}));

const sampleCategories: ProductCategory[] = [
  {
    id: "22222222-2222-4222-8222-222222222201",
    businessId: "biz-1",
    name: "Plats",
    sortOrder: 1,
    role: "regular" as const,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
];

const sampleProduct: EnrichedProduct = {
  id: "33333333-3333-4333-8333-333333333301",
  businessId: "biz-1",
  categoryId: "22222222-2222-4222-8222-222222222201",
  categoryName: "Plats",
  name: "Burger Gourmet",
  description: "Delicious burger",
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

describe("ProductFormSheet Component (Screen M-41)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateProductAction.mockResolvedValue({
      success: true,
      data: { ...sampleProduct, id: "new-prod-id", name: "New Product" },
    });
    mockUpdateProductAction.mockResolvedValue({
      success: true,
      data: { ...sampleProduct, name: "Burger Gourmet Updated" },
    });
    mockUploadProductImageAction.mockResolvedValue({
      success: true,
      data: { imageUrl: "data:image/jpeg;base64,mockedcompressedpayload" },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("toggles allergen chips and submits selected tags without mutating the product", async () => {
    const product = { ...sampleProduct, allergens: ["gluten"] as const };
    const { rerender } = render(
      <ProductFormSheet
        product={{ ...product, allergens: [...product.allergens] }}
        categories={sampleCategories}
        isOpen={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Gluten" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Gluten" }));
    fireEvent.click(screen.getByRole("button", { name: "Milk" }));
    fireEvent.click(screen.getByTestId("save-product-button"));
    await waitFor(() =>
      expect(mockUpdateProductAction).toHaveBeenCalledWith(
        product.id,
        expect.objectContaining({ allergens: ["milk"] }),
      ),
    );
    expect(product.allergens).toEqual(["gluten"]);
    rerender(
      <ProductFormSheet
        categories={sampleCategories}
        isOpen={true}
        onOpenChange={() => {}}
        dict={getDictionary("fr").products}
      />,
    );
    expect(screen.getByText("Allergènes")).toBeDefined();
    expect(screen.getByRole("button", { name: "Lait" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("announces allergen errors returned by the action", async () => {
    mockUpdateProductAction.mockResolvedValueOnce({
      success: false,
      error: "Invalid allergens",
      fieldErrors: { allergens: ["Choose valid allergens"] },
    });
    render(
      <ProductFormSheet
        product={sampleProduct}
        categories={sampleCategories}
        isOpen={true}
        onOpenChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("save-product-button"));
    await waitFor(() =>
      expect(screen.getByText("Choose valid allergens").getAttribute("role")).toBe("alert"),
    );
  });

  it("defaults add-on suggestions on new products and submits the switch value", async () => {
    render(
      <ProductFormSheet categories={sampleCategories} isOpen={true} onOpenChange={() => {}} />,
    );
    const toggle = screen.getByRole("switch", { name: "Suggest add-ons" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Shows Drinks on dishes and Accompaniments on drinks")).toBeDefined();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.change(screen.getByTestId("product-name-input"), { target: { value: "Bread" } });
    fireEvent.change(screen.getByTestId("product-price-input"), { target: { value: "1" } });
    fireEvent.click(screen.getByTestId("save-product-button"));
    await waitFor(() =>
      expect(mockCreateProductAction).toHaveBeenCalledWith(
        expect.objectContaining({ suggestAddOns: false }),
      ),
    );
  });
  it("loads, edits and resets add-on suggestions when switching products", async () => {
    const { rerender } = render(
      <ProductFormSheet
        product={{ ...sampleProduct, suggestAddOns: false }}
        categories={sampleCategories}
        isOpen={true}
        onOpenChange={() => {}}
        dict={getDictionary("fr").products}
      />,
    );
    expect(
      screen.getByRole("switch", { name: "Suggérer des suppléments" }).getAttribute("aria-checked"),
    ).toBe("false");
    fireEvent.click(screen.getByTestId("product-suggest-add-ons-switch"));
    fireEvent.click(screen.getByTestId("save-product-button"));
    await waitFor(() =>
      expect(mockUpdateProductAction).toHaveBeenCalledWith(
        sampleProduct.id,
        expect.objectContaining({ suggestAddOns: true }),
      ),
    );
    rerender(
      <ProductFormSheet categories={sampleCategories} isOpen={true} onOpenChange={() => {}} />,
    );
    expect(
      screen.getByRole("switch", { name: "Suggest add-ons" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("renders Add Product title and empty inputs for new product", () => {
    render(
      <ProductFormSheet categories={sampleCategories} isOpen={true} onOpenChange={() => {}} />,
    );

    expect(screen.getByRole("heading", { name: "Add Product" })).toBeDefined();
    expect((screen.getByTestId("product-name-input") as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("product-price-input") as HTMLInputElement).value).toBe("");
    expect(screen.getByTestId("save-product-button").textContent).toContain("Save Product");
  });

  it("renders Edit Product title and pre-filled inputs for existing product", () => {
    render(
      <ProductFormSheet
        product={sampleProduct}
        categories={sampleCategories}
        isOpen={true}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Edit Product" })).toBeDefined();
    expect((screen.getByTestId("product-name-input") as HTMLInputElement).value).toBe(
      "Burger Gourmet",
    );
    expect((screen.getByTestId("product-price-input") as HTMLInputElement).value).toBe("12.50");
    expect((screen.getByTestId("product-unit-cost-input") as HTMLInputElement).value).toBe("4.20");
    expect(screen.getByText("66.4% margin")).toBeDefined();
    expect(screen.getByTestId("save-product-button").textContent).toContain("Save Changes");
  });

  it("calculates live gross margin preview when price and cost change", () => {
    render(
      <ProductFormSheet categories={sampleCategories} isOpen={true} onOpenChange={() => {}} />,
    );

    const priceInput = screen.getByTestId("product-price-input");
    const costInput = screen.getByTestId("product-unit-cost-input");

    fireEvent.change(priceInput, { target: { value: "10,00" } });
    fireEvent.change(costInput, { target: { value: "2.00" } });

    // (1000 - 200) / 1000 = 80%
    expect(screen.getByText("80% margin")).toBeDefined();
  });

  it("submits valid create form and triggers createProductAction", async () => {
    const handleSaved = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <ProductFormSheet
        categories={sampleCategories}
        isOpen={true}
        onOpenChange={handleOpenChange}
        onProductSaved={handleSaved}
      />,
    );

    fireEvent.change(screen.getByTestId("product-name-input"), {
      target: { value: "Tiramisu Maison" },
    });
    fireEvent.change(screen.getByTestId("product-price-input"), {
      target: { value: "5.00" },
    });
    fireEvent.change(screen.getByTestId("product-unit-cost-input"), {
      target: { value: "1.50" },
    });

    fireEvent.click(screen.getByTestId("save-product-button"));

    await waitFor(() => {
      expect(mockCreateProductAction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Tiramisu Maison",
          price: "5.00",
          unitCost: "1.50",
        }),
      );
      expect(handleSaved).toHaveBeenCalled();
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("submits valid update form and triggers updateProductAction", async () => {
    const handleSaved = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <ProductFormSheet
        product={sampleProduct}
        categories={sampleCategories}
        isOpen={true}
        onOpenChange={handleOpenChange}
        onProductSaved={handleSaved}
      />,
    );

    fireEvent.change(screen.getByTestId("product-name-input"), {
      target: { value: "Burger Gourmet Deluxe" },
    });

    fireEvent.click(screen.getByTestId("save-product-button"));

    await waitFor(() => {
      expect(mockUpdateProductAction).toHaveBeenCalledWith(
        sampleProduct.id,
        expect.objectContaining({
          name: "Burger Gourmet Deluxe",
        }),
      );
      expect(handleSaved).toHaveBeenCalled();
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("handles image file upload and compression", async () => {
    render(
      <ProductFormSheet categories={sampleCategories} isOpen={true} onOpenChange={() => {}} />,
    );

    const file = new File(["dummycontent"], "photo.jpg", { type: "image/jpeg" });
    const fileInput = screen.getByTestId("product-image-input");

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUploadProductImageAction).toHaveBeenCalled();
      expect(screen.getByText("Change photo")).toBeDefined();
    });
  });
});
