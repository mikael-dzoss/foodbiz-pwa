"use server";

import { revalidatePath } from "next/cache";
import { getRepositories } from "@/lib/repositories";
import { defineAction } from "@/lib/actions/define-action";
import { ActionError } from "@/lib/actions/types";
import { revalidateStorefrontCatalog } from "@/features/storefront/catalog-data";
import {
  createCategorySchema,
  renameCategorySchema,
  deleteCategorySchema,
} from "@/domain/category";

const DUPLICATE_NAME = "A category with this name already exists";

function revalidateCategories(businessId: string) {
  revalidatePath("/manage/categories");
  revalidatePath("/manage/products");
  revalidateStorefrontCatalog(businessId);
}

const isSameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Creates a category; names are unique per business. */
export const createCategoryAction = defineAction(
  "createCategory",
  { input: createCategorySchema },
  async ({ input: { name, sortOrder, role }, businessId }) => {
    const repos = getRepositories();
    const existing = await repos.categories.list(businessId);
    if (existing.some((c) => isSameName(c.name, name))) {
      throw new ActionError("CONFLICT", DUPLICATE_NAME);
    }
    const created = await repos.categories.create(businessId, { name, sortOrder, role });
    revalidateCategories(businessId);
    return created;
  },
);

/** Renames a category; the name stays unique across the business. */
export const renameCategoryAction = defineAction(
  "renameCategory",
  { input: renameCategorySchema },
  async ({ input: { id, name, role }, businessId }) => {
    const repos = getRepositories();
    const existing = await repos.categories.list(businessId);
    if (existing.some((c) => c.id !== id && isSameName(c.name, name))) {
      throw new ActionError("CONFLICT", DUPLICATE_NAME);
    }
    const updated = await repos.categories.update(businessId, id, {
      name,
      ...(role === undefined ? {} : { role }),
    });
    revalidateCategories(businessId);
    return updated;
  },
);

/** Deletes a category only if no products are assigned to it. */
export const deleteCategoryAction = defineAction(
  "deleteCategory",
  { input: deleteCategorySchema },
  async ({ input: { id }, businessId }) => {
    const repos = getRepositories();
    const products = await repos.products.list(businessId, { categoryId: id });
    if (products.length > 0) {
      throw new ActionError(
        "CONFLICT",
        `Cannot delete category: ${products.length} product(s) are assigned to it. Please reassign or delete the products first.`,
      );
    }
    await repos.categories.delete(businessId, id);
    revalidateCategories(businessId);
  },
);
