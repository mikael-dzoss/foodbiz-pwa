import type { Product } from "@/domain/product";
import { DEMO_BUSINESS_ID } from "./business";
import { DEMO_CATALOG_PRODUCTS, type DemoProductKey } from "./catalog.data";
import { DEMO_CATEGORY_IDS } from "./categories";

const DEMO_CREATED_AT = "2026-08-01T08:00:00.000Z";

export const demoProducts: Product[] = DEMO_CATALOG_PRODUCTS.map((entry) => ({
  id: entry.id,
  businessId: DEMO_BUSINESS_ID,
  categoryId: DEMO_CATEGORY_IDS[entry.categoryKey],
  name: entry.name,
  description: entry.description,
  price: entry.price,
  unitCost: entry.unitCost,
  stock: entry.stock,
  allergens: [...entry.allergens],
  visible: entry.visible,
  suggestAddOns: entry.suggestAddOns,
  imageUrl: entry.imageUrl,
  createdAt: DEMO_CREATED_AT,
  updatedAt: DEMO_CREATED_AT,
}));

export const DEMO_PRODUCT = Object.fromEntries(
  DEMO_CATALOG_PRODUCTS.map((entry, index) => [entry.key, demoProducts[index]]),
) as Record<DemoProductKey, Product>;

export type { DemoProductKey };
