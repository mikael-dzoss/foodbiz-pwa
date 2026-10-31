"use server";

import { revalidatePath } from "next/cache";
import { getRepositories } from "@/lib/repositories";
import { requireAuthenticatedAction } from "@/features/auth";
import { revalidateStorefrontCatalog } from "@/features/storefront/catalog-data";
import {
  productFormInputSchema,
  adjustStockSchema,
  toggleProductVisibilitySchema,
  type Product,
  type ProductCategory,
} from "@/domain";
import { z } from "zod";

export type ProductActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export interface EnrichedProduct extends Product {
  categoryName?: string;
}

export interface ListProductsResult {
  products: EnrichedProduct[];
  categories: ProductCategory[];
  lowStockThreshold: number;
}

/**
 * Lists all products for the authenticated manager's business,
 * enriched with category names and current low-stock threshold.
 */
export async function listProductsAction(filter?: {
  categoryId?: string;
  visibleOnly?: boolean;
}): Promise<ProductActionResult<ListProductsResult>> {
  const { businessId } = await requireAuthenticatedAction();
  const repos = getRepositories();

  const [products, categories, settings] = await Promise.all([
    repos.products.list(businessId, filter),
    repos.categories.list(businessId),
    repos.business.getSettings(businessId),
  ]);

  const catMap = new Map<string, string>();
  for (const cat of categories) {
    catMap.set(cat.id, cat.name);
  }

  const enriched: EnrichedProduct[] = products.map((p) => ({
    ...p,
    categoryName: catMap.get(p.categoryId) ?? "Uncategorized",
  }));

  const lowStockThreshold = settings?.lowStockThreshold ?? 5;

  return {
    success: true,
    data: {
      products: enriched,
      categories,
      lowStockThreshold,
    },
  };
}

/**
 * Retrieves a single product by ID for the manager's business.
 */
export async function getProductAction(
  productId: string,
): Promise<ProductActionResult<EnrichedProduct>> {
  const { businessId } = await requireAuthenticatedAction();
  const repos = getRepositories();

  const product = await repos.products.findById(businessId, productId);
  if (!product) {
    return { success: false, error: "Product not found" };
  }

  const category = await repos.categories.findById(businessId, product.categoryId);

  return {
    success: true,
    data: {
      ...product,
      categoryName: category?.name ?? "Uncategorized",
    },
  };
}

/**
 * Creates a new product for the manager's business.
 * Validates input against productFormInputSchema (converting euro strings or numbers to cents).
 */
export async function createProductAction(
  rawInput: unknown,
): Promise<ProductActionResult<Product>> {
  const { businessId } = await requireAuthenticatedAction();
  const parsed = productFormInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ? String(issue.path[0]) : "general";
      if (!fieldErrors[field]) fieldErrors[field] = [];
      fieldErrors[field].push(issue.message);
    }
    const error = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error, fieldErrors };
  }

  const repos = getRepositories();
  const category = await repos.categories.findById(businessId, parsed.data.categoryId);
  if (!category) {
    return {
      success: false,
      error: "Selected category does not exist",
      fieldErrors: { categoryId: ["Selected category does not exist"] },
    };
  }

  const product = await repos.products.create(businessId, parsed.data);
  revalidatePath("/manage/products");
  await revalidateStorefrontCatalog(businessId);

  return { success: true, data: product };
}

/**
 * Updates an existing product.
 */
export async function updateProductAction(
  productId: string,
  rawInput: unknown,
): Promise<ProductActionResult<Product>> {
  const { businessId } = await requireAuthenticatedAction();
  const parsed = productFormInputSchema
    .partial()
    .extend({
      allergens: productFormInputSchema.shape.allergens.unwrap().optional(),
      suggestAddOns: productFormInputSchema.shape.suggestAddOns.unwrap().optional(),
    })
    .safeParse(rawInput);

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ? String(issue.path[0]) : "general";
      if (!fieldErrors[field]) fieldErrors[field] = [];
      fieldErrors[field].push(issue.message);
    }
    const error = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error, fieldErrors };
  }

  const repos = getRepositories();
  const existing = await repos.products.findById(businessId, productId);
  if (!existing) {
    return { success: false, error: "Product not found" };
  }

  if (parsed.data.categoryId) {
    const category = await repos.categories.findById(businessId, parsed.data.categoryId);
    if (!category) {
      return {
        success: false,
        error: "Selected category does not exist",
        fieldErrors: { categoryId: ["Selected category does not exist"] },
      };
    }
  }

  const updated = await repos.products.update(businessId, productId, parsed.data);
  revalidatePath("/manage/products");
  await revalidateStorefrontCatalog(businessId);

  return { success: true, data: updated };
}

/**
 * Toggles product menu visibility (hide/show).
 */
export async function toggleProductVisibilityAction(
  productId: string,
  visible: boolean,
): Promise<ProductActionResult<Product>> {
  const { businessId } = await requireAuthenticatedAction();
  const parsed = toggleProductVisibilitySchema.safeParse({ productId, visible });

  if (!parsed.success) {
    return { success: false, error: "Invalid product or visibility status" };
  }

  const repos = getRepositories();
  const existing = await repos.products.findById(businessId, productId);
  if (!existing) {
    return { success: false, error: "Product not found" };
  }

  const updated = await repos.products.update(businessId, productId, { visible });
  revalidatePath("/manage/products");
  await revalidateStorefrontCatalog(businessId);

  return { success: true, data: updated };
}

/**
 * Soft-deletes a product by setting visible: false (no hard delete anywhere).
 */
export async function softDeleteProductAction(
  productId: string,
): Promise<ProductActionResult<Product>> {
  const { businessId } = await requireAuthenticatedAction();
  const repos = getRepositories();

  const existing = await repos.products.findById(businessId, productId);
  if (!existing) {
    return { success: false, error: "Product not found" };
  }

  const updated = await repos.products.softDelete(businessId, productId);
  revalidatePath("/manage/products");
  await revalidateStorefrontCatalog(businessId);

  return { success: true, data: updated };
}

/**
 * Adjusts product stock level with non-negative validation and optional reason note.
 */
export async function adjustProductStockAction(
  productId: string,
  newStock: number,
  reason?: string,
): Promise<ProductActionResult<Product>> {
  const { businessId } = await requireAuthenticatedAction();
  const parsed = adjustStockSchema.safeParse({ productId, stock: newStock, reason });

  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error };
  }

  const repos = getRepositories();
  const existing = await repos.products.findById(businessId, productId);
  if (!existing) {
    return { success: false, error: "Product not found" };
  }

  const updated = await repos.products.update(businessId, productId, {
    stock: parsed.data.stock,
  });
  revalidatePath("/manage/products");
  await revalidateStorefrontCatalog(businessId);

  return { success: true, data: updated };
}

const imageUploadSchema = z.object({
  base64Data: z.string().min(1, "Image data is required"),
  fileName: z.string().optional(),
});

/**
 * Handles product image upload (Story #45).
 * Validates format (base64 image payload), stores in mock repository or returns data URL.
 */
export async function uploadProductImageAction(
  rawInput: unknown,
): Promise<ProductActionResult<{ imageUrl: string }>> {
  await requireAuthenticatedAction();
  const parsed = imageUploadSchema.safeParse(rawInput);

  if (!parsed.success) {
    return { success: false, error: "Invalid image upload payload" };
  }

  const { base64Data } = parsed.data;
  if (!base64Data.startsWith("data:image/")) {
    return { success: false, error: "Uploaded file must be a valid image data URL." };
  }

  // In mock environment / adapter, return the compressed image data URL directly.
  return {
    success: true,
    data: {
      imageUrl: base64Data,
    },
  };
}
