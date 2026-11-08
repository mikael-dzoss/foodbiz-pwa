import type { Product, ProductCategory } from "./product";

export type AddOnKind = "drinks" | "accompaniments";

export interface AddOnCandidates {
  kind: AddOnKind;
  products: Product[];
}

/**
 * Pure domain helper that returns optional add-on product candidates for a storefront product (#206, #207).
 * - Non-drink, non-snack products with `suggestAddOns: true` suggest visible, in-stock drinks.
 * - Drink products with `suggestAddOns: true` suggest visible, in-stock snacks as accompaniments.
 * - Snack products suggest no add-ons.
 * - Candidates are sorted by category `sortOrder` ascending, then product `name` ascending.
 * - Returns `null` when `suggestAddOns` is false, product role has no add-ons, or no candidates exist.
 */
export function getAddOnCandidates(
  product: Product,
  categories: readonly ProductCategory[],
  products: readonly Product[],
): AddOnCandidates | null {
  if (!product.suggestAddOns) {
    return null;
  }

  const productCategory = categories.find((cat) => cat.id === product.categoryId);
  const productRole = productCategory?.role ?? "regular";

  if (productRole === "snacks") {
    return null;
  }

  const targetCategoryRole = productRole === "drinks" ? "snacks" : "drinks";
  const kind: AddOnKind = productRole === "drinks" ? "accompaniments" : "drinks";

  const targetCategorySortOrders = new Map<string, number>();
  for (const cat of categories) {
    if (cat.role === targetCategoryRole) {
      targetCategorySortOrders.set(cat.id, cat.sortOrder);
    }
  }

  if (targetCategorySortOrders.size === 0) {
    return null;
  }

  const candidates = products
    .filter(
      (candidate) =>
        candidate.id !== product.id &&
        candidate.visible &&
        candidate.stock > 0 &&
        targetCategorySortOrders.has(candidate.categoryId),
    )
    .toSorted((a, b) => {
      const sortA = targetCategorySortOrders.get(a.categoryId) ?? 0;
      const sortB = targetCategorySortOrders.get(b.categoryId) ?? 0;
      return sortA - sortB || a.name.localeCompare(b.name, "en");
    });

  if (candidates.length === 0) {
    return null;
  }

  return {
    kind,
    products: candidates,
  };
}
