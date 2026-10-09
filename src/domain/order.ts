import { z } from "zod";
import {
  isoDateSchema,
  isoDateTimeSchema,
  moneySchema,
  timeHHMMSchema,
  uuidSchema,
} from "./common";

export const orderStatusSchema = z.enum([
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const paidStatusSchema = z.enum(["paid", "unpaid"]);
export type PaidStatus = z.infer<typeof paidStatusSchema>;

export const serviceTypeSchema = z.enum(["pickup", "delivery", "dine-in"]);
export type ServiceType = z.infer<typeof serviceTypeSchema>;

export const channelSchema = z.enum(["storefront", "phone", "whatsapp", "in-person"]);
export type Channel = z.infer<typeof channelSchema>;

export const paymentPreferenceSchema = z.enum(["revolut", "wero", "on_handover"]);
export type PaymentPreference = z.infer<typeof paymentPreferenceSchema>;

export const paymentMethodSchema = z.enum(["cash", "revolut", "wero"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const orderItemSchema = z.object({
  id: uuidSchema.optional(),
  productId: uuidSchema,
  productName: z.string().trim().min(1),
  quantity: z.number().int().min(1),
  unitPrice: moneySchema,
  totalPrice: moneySchema,
});

export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderSchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  orderNumber: z.number().int().positive().optional(),
  guestId: uuidSchema.optional().nullable(),
  guestName: z.string().trim().min(1),
  serviceType: serviceTypeSchema,
  channel: channelSchema,
  status: orderStatusSchema,
  paid: paidStatusSchema,
  paymentPreference: paymentPreferenceSchema,
  paymentMethod: paymentMethodSchema.optional().nullable(),
  paidAt: isoDateTimeSchema.optional().nullable(),
  requestedDate: isoDateSchema,
  requestedTime: timeHHMMSchema.optional().nullable(),
  items: z.array(orderItemSchema).min(1),
  totalAmount: moneySchema,
  cancellationReason: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Order = z.infer<typeof orderSchema>;
