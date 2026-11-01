import { z } from "zod";
import { categoryRoleSchema } from "@/domain/category";
import { allergenSchema } from "@/domain/allergen";
import { isoDateTimeSchema, moneySchema, uuidSchema } from "./common";

export const productCategorySchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  name: z.string().trim().min(1),
  sortOrder: z.number().int().min(0).default(0),
  role: categoryRoleSchema.default("regular"),
  createdAt: isoDateTimeSchema,
});

export type ProductCategory = z.infer<typeof productCategorySchema>;

export const productSchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  categoryId: uuidSchema,
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  price: moneySchema,
  unitCost: moneySchema.default(0),
  stock: z.number().int().min(0).default(0),
  visible: z.boolean().default(true),
  suggestAddOns: z.boolean().default(true),
  allergens: z.array(allergenSchema).default([]),
  imageUrl: z.string().trim().optional().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Product = z.infer<typeof productSchema>;

/**
 * Parses a euro input string (e.g. "12.50", "12,50", "12,50 €", "5") into integer cents.
 * Returns NaN if input cannot be parsed.
 */
export function parseEuroStringToCents(val: string): number {
  if (!val || typeof val !== "string") return NaN;
  const normalized = val.trim().replace(/€/g, "").replace(/\s/g, "").replace(",", ".");
  if (normalized.length === 0) return NaN;
  const num = Number(normalized);
  if (isNaN(num)) return NaN;
  return Math.round(num * 100);
}

/**
 * Converts integer cents into a two-decimal euro string (e.g. 1250 -> "12.50").
 */
export function centsToEuroString(cents: number): string {
  if (isNaN(cents) || cents < 0) return "0.00";
  return (cents / 100).toFixed(2);
}

/**
 * Calculates gross margin percentage: ((price - unitCost) / price) * 100.
 * Returns rounded to 1 decimal place. Returns 0 if price <= 0.
 */
export function calculateGrossMargin(priceInCents: number, unitCostInCents: number): number {
  if (priceInCents <= 0) return 0;
  const margin = ((priceInCents - unitCostInCents) / priceInCents) * 100;
  return Math.max(0, Math.round(margin * 10) / 10);
}

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  categoryId: uuidSchema,
  description: z.string().trim().max(1000).optional().nullable(),
  price: moneySchema,
  unitCost: moneySchema.default(0),
  stock: z.number().int().min(0, "Stock cannot be negative").default(0),
  visible: z.boolean().default(true),
  suggestAddOns: z.boolean().default(true),
  allergens: z.array(allergenSchema).default([]),
  imageUrl: z.string().trim().optional().nullable(),
});

export type CreateProductInputSchema = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1, "Product name is required").optional(),
  categoryId: uuidSchema.optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  price: moneySchema.optional(),
  unitCost: moneySchema.optional(),
  stock: z.number().int().min(0, "Stock cannot be negative").optional(),
  visible: z.boolean().optional(),
  suggestAddOns: z.boolean().default(true),
  allergens: z.array(allergenSchema).default([]),
  imageUrl: z.string().trim().optional().nullable(),
});

export type UpdateProductInputSchema = z.infer<typeof updateProductSchema>;

/**
 * Unified form schema used on both client and server to validate product creation & updates.
 * Coerces and normalizes user input (decimal string or integer cents, boolean or "on").
 */
export const productFormInputSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  categoryId: uuidSchema,
  description: z.string().trim().max(1000).optional().nullable(),
  price: z.union([z.number(), z.string()]).transform((val, ctx) => {
    if (typeof val === "number") {
      if (!Number.isInteger(val) || val < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Price must be a positive integer in cents",
        });
        return z.NEVER;
      }
      return val;
    }
    const cents = parseEuroStringToCents(val);
    if (isNaN(cents) || cents < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Price must be a valid positive amount",
      });
      return z.NEVER;
    }
    return cents;
  }),
  unitCost: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val, ctx) => {
      if (val === undefined || val === null || val === "") return 0;
      if (typeof val === "number") {
        if (!Number.isInteger(val) || val < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Unit cost must be a positive integer in cents",
          });
          return z.NEVER;
        }
        return val;
      }
      const cents = parseEuroStringToCents(val);
      if (isNaN(cents) || cents < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unit cost must be a valid positive amount",
        });
        return z.NEVER;
      }
      return cents;
    }),
  stock: z.coerce
    .number()
    .int({ message: "Stock must be an integer" })
    .min(0, { message: "Stock cannot be negative" })
    .default(0),
  visible: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "on")
    .default(true),
  suggestAddOns: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "on")
    .default(true),
  allergens: z.array(allergenSchema).default([]),
  imageUrl: z.string().trim().optional().nullable(),
});

export type ProductFormInput = z.infer<typeof productFormInputSchema>;

export const adjustStockSchema = z.object({
  productId: uuidSchema,
  stock: z.number().int("Stock must be an integer").min(0, "Stock cannot be negative"),
  reason: z.string().trim().optional(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const toggleProductVisibilitySchema = z.object({
  productId: uuidSchema,
  visible: z.boolean(),
});

export type ToggleProductVisibilityInput = z.infer<typeof toggleProductVisibilitySchema>;

export interface SearchableCategoryGroup<
  TProduct extends Pick<Product, "name" | "description"> = Product,
> {
  id: string;
  name: string;
  products: readonly TProduct[];
}

export interface MenuSearchResult<
  TProduct extends Pick<Product, "name" | "description"> = Product,
> {
  product: TProduct;
  categoryName: string;
}

/**
 * Normalizes a string for case-insensitive and diacritics-insensitive search (#203).
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .trim();
}

/**
 * Pure helper that filters grouped catalog products by a search query (#203).
 * Matches case- and diacritics-insensitively against product name, description, or category name.
 * Returns an empty array when the query is blank.
 */
export function searchMenuProducts<
  TProduct extends Pick<Product, "name" | "description"> = Product,
>(
  groups: readonly SearchableCategoryGroup<TProduct>[],
  query: string,
): MenuSearchResult<TProduct>[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const results: MenuSearchResult<TProduct>[] = [];
  for (const group of groups) {
    const categoryMatches = normalizeSearchText(group.name).includes(normalizedQuery);
    for (const product of group.products) {
      const nameMatches = normalizeSearchText(product.name).includes(normalizedQuery);
      const descriptionMatches = product.description
        ? normalizeSearchText(product.description).includes(normalizedQuery)
        : false;
      if (nameMatches || descriptionMatches || categoryMatches) {
        results.push({ product, categoryName: group.name });
      }
    }
  }

  return results;
}
