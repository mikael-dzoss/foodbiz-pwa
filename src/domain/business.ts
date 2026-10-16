import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";

export const businessSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  currency: z.literal("EUR").default("EUR"),
  description: z.string().trim().max(500).optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  whatsappNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  logoUrl: z.string().trim().optional().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Business = z.infer<typeof businessSchema>;

export const updateBusinessProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase alphanumeric characters and hyphens"),
  description: z.string().trim().max(500, "Description must be 500 characters or less").optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  whatsappNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  logoUrl: z.string().trim().optional().nullable(),
});

export type UpdateBusinessProfileInput = z.infer<typeof updateBusinessProfileSchema>;

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
