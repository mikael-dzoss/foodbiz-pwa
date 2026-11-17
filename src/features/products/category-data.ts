import "server-only";

import { requireAuthenticatedAction } from "@/features/auth";
import { getRepositories } from "@/lib/repositories";
import type { ProductCategory } from "@/domain/product";

export type CategoryWithProductCount = ProductCategory & {
  productCount?: number;
};

/** Categories of the manager's business with the count of products in each. Errors throw. */
export async function listCategories(): Promise<CategoryWithProductCount[]> {
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
  return categories.map((cat) => ({ ...cat, productCount: countByCat.get(cat.id) ?? 0 }));
}
