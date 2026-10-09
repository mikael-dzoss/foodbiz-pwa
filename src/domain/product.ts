import { z } from "zod";
import { isoDateTimeSchema, moneySchema, uuidSchema } from "./common";

export const productCategorySchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  name: z.string().trim().min(1),
  sortOrder: z.number().int().min(0).default(0),
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
  imageUrl: z.string().trim().optional().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Product = z.infer<typeof productSchema>;
