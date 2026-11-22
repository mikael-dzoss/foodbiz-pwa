import type { ProductCategory } from "@/domain/product";
import { DEMO_BUSINESS_ID } from "./business";

export const DEMO_CATEGORY_IDS = {
  breads: "22222222-2222-4222-8222-222222222201",
  pastries: "22222222-2222-4222-8222-222222222202",
  snacks: "22222222-2222-4222-8222-222222222204",
  beverages: "22222222-2222-4222-8222-222222222203",
} as const;

export const demoCategories: ProductCategory[] = [
  {
    id: DEMO_CATEGORY_IDS.breads,
    businessId: DEMO_BUSINESS_ID,
    name: "Breads & Baguettes",
    sortOrder: 1,
    role: "regular",
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: DEMO_CATEGORY_IDS.pastries,
    businessId: DEMO_BUSINESS_ID,
    name: "Pastries & Viennoiserie",
    sortOrder: 2,
    role: "regular",
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: DEMO_CATEGORY_IDS.beverages,
    businessId: DEMO_BUSINESS_ID,
    name: "Hot & Cold Beverages",
    sortOrder: 3,
    role: "drinks",
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: DEMO_CATEGORY_IDS.snacks,
    businessId: DEMO_BUSINESS_ID,
    name: "Snacks",
    sortOrder: 4,
    role: "snacks",
    createdAt: "2026-08-01T08:00:00.000Z",
  },
];
