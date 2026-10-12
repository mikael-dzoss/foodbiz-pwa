import { z } from "zod";
import { uuidSchema } from "./common";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50, "Name must be 50 characters or fewer"),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateCategoryActionInput = z.infer<typeof createCategorySchema>;

export const renameCategorySchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1, "Name is required").max(50, "Name must be 50 characters or fewer"),
});

export type RenameCategoryActionInput = z.infer<typeof renameCategorySchema>;

export const deleteCategorySchema = z.object({
  id: uuidSchema,
});

export type DeleteCategoryActionInput = z.infer<typeof deleteCategorySchema>;
