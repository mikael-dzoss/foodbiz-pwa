"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepositories } from "@/lib/repositories";
import { defineAction } from "@/lib/actions/define-action";
import { ActionError } from "@/lib/actions/types";
import { revalidateStorefrontCatalog } from "@/features/storefront/catalog-data";
import { getServerEnv } from "@/config/env";
import { parseProductImageDataUrl } from "@/domain/product-image";
import { uploadProductImage, removeProductImage } from "./product-storage";
import { productFormInputSchema, adjustStockSchema, toggleProductVisibilitySchema } from "@/domain";
import { uuidSchema } from "@/domain/common";

const CATEGORY_MISSING = "Selected category does not exist";

const updateProductSchema = productFormInputSchema
  .partial()
  .extend({
    allergens: productFormInputSchema.shape.allergens.unwrap().optional(),
    suggestAddOns: productFormInputSchema.shape.suggestAddOns.unwrap().optional(),
  })
  .extend({ id: uuidSchema });

const imageUploadSchema = z.object({
  base64Data: z.string().min(1, "Image data is required"),
  fileName: z.string().optional(),
});

/** Manager list and the public catalog both change with a product. */
function revalidateProducts(businessId: string) {
  revalidatePath("/manage/products");
  revalidateStorefrontCatalog(businessId);
}

async function requireProduct(businessId: string, id: string) {
  const product = await getRepositories().products.findById(businessId, id);
  if (!product) throw new ActionError("NOT_FOUND", "Product not found");
  return product;
}

async function requireCategory(businessId: string, categoryId: string) {
  if (!(await getRepositories().categories.findById(businessId, categoryId))) {
    throw new ActionError("VALIDATION", CATEGORY_MISSING, {
      fieldErrors: { categoryId: [CATEGORY_MISSING] },
    });
  }
}

/** Creates a product (euro strings or numbers become cents in the schema). */
export const createProductAction = defineAction(
  "createProduct",
  { input: productFormInputSchema },
  async ({ input, businessId }) => {
    await requireCategory(businessId, input.categoryId);
    const product = await getRepositories().products.create(businessId, input);
    revalidateProducts(businessId);
    return product;
  },
);

/** Updates an existing product: the id plus the fields to change. */
export const updateProductAction = defineAction(
  "updateProduct",
  { input: updateProductSchema },
  async ({ input: { id, ...patch }, businessId }) => {
    const existing = await requireProduct(businessId, id);
    if (patch.categoryId) await requireCategory(businessId, patch.categoryId);

    // Orphan cleanup (Story #123, L4a): a replaced or cleared image leaves no storage object behind.
    if (patch.imageUrl !== undefined && existing.imageUrl && patch.imageUrl !== existing.imageUrl) {
      await removeProductImage(businessId, existing.imageUrl);
    }

    const updated = await getRepositories().products.update(businessId, id, patch);
    revalidateProducts(businessId);
    return updated;
  },
);

/** Hides or shows a product on the menu. */
export const toggleProductVisibilityAction = defineAction(
  "toggleProductVisibility",
  { input: toggleProductVisibilitySchema },
  async ({ input: { productId, visible }, businessId }) => {
    await requireProduct(businessId, productId);
    const updated = await getRepositories().products.update(businessId, productId, { visible });
    revalidateProducts(businessId);
    return updated;
  },
);

/** Soft-deletes a product by setting visible: false (no hard delete anywhere). */
export const softDeleteProductAction = defineAction(
  "softDeleteProduct",
  { input: uuidSchema },
  async ({ input: productId, businessId }) => {
    const existing = await requireProduct(businessId, productId);
    // Orphan cleanup (Story #123, L4a): remove the storage object on soft-delete.
    if (existing.imageUrl) await removeProductImage(businessId, existing.imageUrl);
    const updated = await getRepositories().products.softDelete(businessId, productId);
    revalidateProducts(businessId);
    return updated;
  },
);

/** Sets a product's stock level (non-negative) with an optional reason note. */
export const adjustProductStockAction = defineAction(
  "adjustProductStock",
  { input: adjustStockSchema },
  async ({ input: { productId, stock }, businessId }) => {
    await requireProduct(businessId, productId);
    const updated = await getRepositories().products.update(businessId, productId, { stock });
    revalidateProducts(businessId);
    return updated;
  },
);

/**
 * Product image upload (Story #45, #123). Validates format, MIME type and size; stores in Supabase
 * Storage, or returns the data URL in mock mode.
 */
export const uploadProductImageAction = defineAction(
  "uploadProductImage",
  { input: imageUploadSchema },
  async ({ input, businessId }) => {
    const image = parseProductImageDataUrl(input.base64Data);
    if (!image.ok) throw new ActionError("VALIDATION", image.error);

    if (getServerEnv().DATA_SOURCE === "supabase") {
      return { imageUrl: await uploadProductImage(businessId, input) };
    }
    return { imageUrl: input.base64Data };
  },
);
