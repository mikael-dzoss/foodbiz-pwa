import { z } from "zod";
import { MAX_QUANTITY_PER_LINE } from "./anti-abuse";
import { productSchema, type Product } from "./product";

/**
 * Product shape sent to the browser by the public storefront. It is an allow-list: private
 * fields (unit cost, business id, timestamps, visibility) never leave the server.
 *
 * `stock` is the orderable quantity, capped at the per-line order limit: the UI only needs to
 * know "out of stock", "N left" when low, and the most a customer can add to the cart.
 */
export const storefrontProductSchema = productSchema
  .pick({
    id: true,
    categoryId: true,
    name: true,
    description: true,
    price: true,
    allergens: true,
    imageUrl: true,
    suggestAddOns: true,
  })
  .extend({ stock: z.number().int().min(0).max(MAX_QUANTITY_PER_LINE) });

export type StorefrontProduct = z.infer<typeof storefrontProductSchema>;

/** Explicitly copies the allow-listed fields (never spreads) so new Product fields cannot leak. */
export function toStorefrontProduct(product: Product): StorefrontProduct {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    price: product.price,
    allergens: product.allergens,
    imageUrl: product.imageUrl,
    suggestAddOns: product.suggestAddOns,
    stock: Math.min(Math.max(product.stock, 0), MAX_QUANTITY_PER_LINE),
  };
}
