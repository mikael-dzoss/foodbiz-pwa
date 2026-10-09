import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";

export const businessSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  currency: z.literal("EUR").default("EUR"),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Business = z.infer<typeof businessSchema>;

export const businessMemberRoleSchema = z.enum(["owner", "manager", "staff"]);
export type BusinessMemberRole = z.infer<typeof businessMemberRoleSchema>;

export const businessMemberSchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  userId: uuidSchema,
  role: businessMemberRoleSchema,
  createdAt: isoDateTimeSchema,
});

export type BusinessMember = z.infer<typeof businessMemberSchema>;

export const dateFormatSchema = z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]);
export type DateFormat = z.infer<typeof dateFormatSchema>;

export const businessSettingsSchema = z.object({
  id: uuidSchema.optional(),
  businessId: uuidSchema,
  currency: z.literal("EUR").default("EUR"),
  dateFormat: dateFormatSchema.default("DD/MM/YYYY"),
  lowStockThreshold: z.number().int().min(0).default(5),
  taxPercentage: z.number().min(0).max(100).default(0),
  notifications: z.boolean().default(true),
});

export type BusinessSettings = z.infer<typeof businessSettingsSchema>;
