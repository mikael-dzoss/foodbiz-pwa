import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";

const socialUrlSchema = z
  .url({ protocol: /^https$/ })
  .optional()
  .or(z.literal(""));

export const latitudeSchema = z
  .number()
  .min(-90, "Latitude must be between -90 and 90")
  .max(90, "Latitude must be between -90 and 90")
  .optional()
  .nullable();

export const longitudeSchema = z
  .number()
  .min(-180, "Longitude must be between -180 and 180")
  .max(180, "Longitude must be between -180 and 180")
  .optional()
  .nullable();

export function buildOpenStreetMapEmbedUrl(
  latitude: number,
  longitude: number,
  delta = 0.004,
): string {
  const minLng = Number((longitude - delta).toFixed(6));
  const minLat = Number((latitude - delta).toFixed(6));
  const maxLng = Number((longitude + delta).toFixed(6));
  const maxLat = Number((latitude + delta).toFixed(6));
  const lat = Number(latitude.toFixed(6));
  const lng = Number(longitude.toFixed(6));
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik&marker=${lat},${lng}`;
}

export const businessSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  currency: z.literal("EUR").default("EUR"),
  description: z.string().trim().max(500).optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  whatsappNumber: z.string().trim().optional(),
  instagramUrl: socialUrlSchema,
  facebookUrl: socialUrlSchema,
  tiktokUrl: socialUrlSchema,
  address: z.string().trim().optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
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
  instagramUrl: socialUrlSchema,
  facebookUrl: socialUrlSchema,
  tiktokUrl: socialUrlSchema,
  address: z.string().trim().optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
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

  // Ordering settings (#71)
  acceptingOrders: z.boolean().default(true),
  serviceTypes: z
    .object({
      pickup: z.boolean().default(true),
      delivery: z.boolean().default(true),
      dineIn: z.boolean().default(true),
    })
    .default({ pickup: true, delivery: true, dineIn: true }),
  openingHours: z.string().trim().max(500).optional().default(""),
  orderTimingAsap: z.boolean().default(true),
  orderTimingScheduled: z.boolean().default(true),
  orderTimingTimeOptional: z.boolean().default(true),
  deliveryFee: z.number().int().min(0).default(0), // cents
  minOrderAmount: z.number().int().min(0).default(0), // cents

  // Payment settings (#72)
  revolutRevtag: z.string().trim().optional().default(""),
  weroIdentifier: z.string().trim().optional().default(""),
  paymentMethods: z
    .object({
      cash: z.boolean().default(true),
      revolut: z.boolean().default(true),
      wero: z.boolean().default(true),
    })
    .default({ cash: true, revolut: true, wero: true }),
  paymentInstructionsEn: z.string().trim().max(1000).optional().default(""),
  paymentInstructionsFr: z.string().trim().max(1000).optional().default(""),

  // Notifications & sound (#74)
  inAppAlerts: z.boolean().default(true),
  soundAlerts: z.boolean().default(true),
});

export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

export const updateOrderingSettingsSchema = z
  .object({
    acceptingOrders: z.boolean(),
    serviceTypes: z.object({
      pickup: z.boolean(),
      delivery: z.boolean(),
      dineIn: z.boolean(),
    }),
    openingHours: z.string().trim().max(500).optional().default(""),
    orderTimingAsap: z.boolean().default(true),
    orderTimingScheduled: z.boolean().default(true),
    orderTimingTimeOptional: z.boolean().default(true),
    deliveryFee: z.number().int().min(0, "Delivery fee must be 0 or positive").default(0),
    minOrderAmount: z
      .number()
      .int()
      .min(0, "Minimum order amount must be 0 or positive")
      .default(0),
  })
  .refine(
    (data) => data.serviceTypes.pickup || data.serviceTypes.delivery || data.serviceTypes.dineIn,
    {
      message: "At least one service type must be enabled",
      path: ["serviceTypes"],
    },
  );

export type UpdateOrderingSettingsInput = z.infer<typeof updateOrderingSettingsSchema>;

export const updatePaymentSettingsSchema = z
  .object({
    revolutRevtag: z.string().trim().optional().default(""),
    weroIdentifier: z.string().trim().optional().default(""),
    paymentMethods: z.object({
      cash: z.boolean(),
      revolut: z.boolean(),
      wero: z.boolean(),
    }),
    paymentInstructionsEn: z.string().trim().max(1000).optional().default(""),
    paymentInstructionsFr: z.string().trim().max(1000).optional().default(""),
  })
  .refine(
    (data) => data.paymentMethods.cash || data.paymentMethods.revolut || data.paymentMethods.wero,
    {
      message: "At least one payment option must be enabled",
      path: ["paymentMethods"],
    },
  );

export type UpdatePaymentSettingsInput = z.infer<typeof updatePaymentSettingsSchema>;

export const updateInventoryFinanceSettingsSchema = z.object({
  lowStockThreshold: z
    .number()
    .int("Low-stock threshold must be an integer")
    .min(0, "Low-stock threshold must be 0 or greater")
    .default(5),
  taxPercentage: z
    .number()
    .min(0, "Tax percentage must be at least 0")
    .max(100, "Tax percentage cannot exceed 100")
    .default(0),
  currency: z.literal("EUR").default("EUR"),
  dateFormat: dateFormatSchema.default("DD/MM/YYYY"),
});

export type UpdateInventoryFinanceSettingsInput = z.infer<
  typeof updateInventoryFinanceSettingsSchema
>;

export const updateNotificationSettingsSchema = z.object({
  notifications: z.boolean().default(true),
  inAppAlerts: z.boolean().default(true),
  soundAlerts: z.boolean().default(true),
});

export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;
