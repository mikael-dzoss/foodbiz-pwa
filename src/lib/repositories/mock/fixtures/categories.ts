import type { ProductCategory } from "@/domain/product";
import { DEMO_BUSINESS_ID } from "./business";
import { DEMO_CATALOG_CATEGORIES } from "./catalog.data";

const DEMO_CREATED_AT = "2026-08-01T08:00:00.000Z";

export const DEMO_CATEGORY_IDS = {
  meatFish: "22222222-2222-4222-8222-222222222201",
  traditional: "22222222-2222-4222-8222-222222222202",
  fritters: "22222222-2222-4222-8222-222222222204",
  drinks: "22222222-2222-4222-8222-222222222203",
} as const;

export const demoCategories: ProductCategory[] = DEMO_CATALOG_CATEGORIES.map((category) => ({
  id: category.id,
  businessId: DEMO_BUSINESS_ID,
  name: category.name,
  sortOrder: category.sortOrder,
  role: category.role,
  createdAt: DEMO_CREATED_AT,
}));
