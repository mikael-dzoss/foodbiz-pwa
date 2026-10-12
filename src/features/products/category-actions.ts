"use server";

import { revalidatePath } from "next/cache";
import { getRepositories } from "@/lib/repositories";
import { requireAuthenticatedAction } from "@/features/auth";
import {
  createCategorySchema,
  renameCategorySchema,
  deleteCategorySchema,
} from "@/domain/category";
import type { ProductCategory } from "@/domain/product";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

export type CategoryWithProductCount = ProductCategory & {
  productCount?: number;
};

/**
 * Lists categories for the current authenticated manager's business,
 * enriched with the count of active products belonging to each category.
 */
export async function listCategoriesAction(): Promise<ActionResult<CategoryWithProductCount[]>> {
  const { businessId } = await requireAuthenticatedAction();
  const repos = getRepositories();
  const [categories, products] = await Promise.all([
    repos.categories.list(businessId),
    repos.products.list(businessId),
  ]);

  const countByCat = new Map<string, number>();
  for (const p of products) {
    countByCat.set(p.categoryId, (countByCat.get(p.categoryId) ?? 0) + 1);
  }

  const data: CategoryWithProductCount[] = categories.map((cat) => ({
    ...cat,
    productCount: countByCat.get(cat.id) ?? 0,
  }));

  return { success: true, data };
}

/**
 * Creates a new category for the manager's business.
 * Validates with zod and enforces unique category name per business.
 */
export async function createCategoryAction(
  rawInput: unknown,
): Promise<ActionResult<ProductCategory>> {
  const { businessId } = await requireAuthenticatedAction();
  const parsed = createCategorySchema.safeParse(rawInput);

  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error };
  }

  const { name, sortOrder } = parsed.data;
  const repos = getRepositories();
  const existing = await repos.categories.list(businessId);

  const duplicate = existing.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());

  if (duplicate) {
    return {
      success: false,
      error: "A category with this name already exists",
    };
  }

  const created = await repos.categories.create(businessId, {
    name,
    sortOrder,
  });

  revalidatePath("/manage/categories");
  return { success: true, data: created };
}

/**
 * Renames an existing category.
 * Validates with zod and enforces unique name across other categories in the business.
 */
export async function renameCategoryAction(
  rawInput: unknown,
): Promise<ActionResult<ProductCategory>> {
  const { businessId } = await requireAuthenticatedAction();
  const parsed = renameCategorySchema.safeParse(rawInput);

  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error };
  }

  const { id, name } = parsed.data;
  const repos = getRepositories();
  const existing = await repos.categories.list(businessId);

  const duplicate = existing.some(
    (c) => c.id !== id && c.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );

  if (duplicate) {
    return {
      success: false,
      error: "A category with this name already exists",
    };
  }

  const updated = await repos.categories.update(businessId, id, { name });

  revalidatePath("/manage/categories");
  return { success: true, data: updated };
}

/**
 * Deletes a category only if it contains no assigned products.
 * Returns an explanatory error if non-empty.
 */
export async function deleteCategoryAction(rawInput: unknown): Promise<ActionResult<void>> {
  const { businessId } = await requireAuthenticatedAction();
  const parsed = deleteCategorySchema.safeParse(rawInput);

  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error };
  }

  const { id } = parsed.data;
  const repos = getRepositories();

  const products = await repos.products.list(businessId, { categoryId: id });
  if (products.length > 0) {
    return {
      success: false,
      error: `Cannot delete category: ${products.length} product(s) are assigned to it. Please reassign or delete the products first.`,
    };
  }

  await repos.categories.delete(businessId, id);

  revalidatePath("/manage/categories");
  return { success: true, data: undefined };
}
