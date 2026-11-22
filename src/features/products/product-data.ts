import "server-only";

import { requireAuthenticatedAction } from "@/features/auth";
import { getRepositories } from "@/lib/repositories";
import type { Product, ProductCategory } from "@/domain";
import type { ProductFilter } from "@/domain/repositories";

export interface EnrichedProduct extends Product {
  categoryName?: string;
}

export interface ListProductsResult {
  products: EnrichedProduct[];
  categories: ProductCategory[];
  lowStockThreshold: number;
}

/**
 * All products of the manager's business, enriched with category names, plus the categories and the
 * low-stock threshold. Read errors throw to the route error boundary.
 */
export async function listProducts(filter?: ProductFilter): Promise<ListProductsResult> {
  const { businessId } = await requireAuthenticatedAction();
  const repos = getRepositories();
  const [products, categories, settings] = await Promise.all([
    repos.products.list(businessId, filter),
    repos.categories.list(businessId),
    repos.business.getSettings(businessId),
  ]);

  const names = new Map(categories.map((c) => [c.id, c.name]));
  return {
    products: products.map((p) => ({
      ...p,
      categoryName: names.get(p.categoryId) ?? "Uncategorized",
    })),
    categories,
    lowStockThreshold: settings?.lowStockThreshold ?? 5,
  };
}
