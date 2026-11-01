import type { Product, ProductCategory } from "./product";

export type AddOnKind = "drinks" | "accompaniments";

export interface AddOnCandidates {
  kind: AddOnKind;
  products: Product[];
}

/**
 * Pure domain helper that returns optional add-on product candidates for a storefront product (#206).
 * - Non-drink, non-snack products with `suggestAddOns: true` suggest visible, in-stock drinks.
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

  if (productRole === "drinks" || productRole === "snacks") {
    return null;
  }

  const drinkCategorySortOrders = new Map<string, number>();
  for (const cat of categories) {
    if (cat.role === "drinks") {
      drinkCategorySortOrders.set(cat.id, cat.sortOrder);
    }
  }

  if (drinkCategorySortOrders.size === 0) {
    return null;
  }

  const candidates = products
    .filter(
      (candidate) =>
        candidate.id !== product.id &&
        candidate.visible &&
        candidate.stock > 0 &&
        drinkCategorySortOrders.has(candidate.categoryId),
    )
    .toSorted((a, b) => {
      const sortA = drinkCategorySortOrders.get(a.categoryId) ?? 0;
      const sortB = drinkCategorySortOrders.get(b.categoryId) ?? 0;
      return sortA - sortB || a.name.localeCompare(b.name, "en");
    });

  if (candidates.length === 0) {
    return null;
  }

  return {
    kind: "drinks",
    products: candidates,
  };
}
