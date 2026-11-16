import { z } from "zod";
import {
  isoDateSchema,
  isoDateTimeSchema,
  moneySchema,
  timeHHMMSchema,
  uuidSchema,
} from "./common";
import { type Guest, guestNameSchema, isValidPhoneNumber } from "./guest";

export const orderStatusSchema = z.enum([
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const paidStatusSchema = z.enum(["paid", "unpaid", "refunded"]);
export type PaidStatus = z.infer<typeof paidStatusSchema>;

// Recommendation: While constrained strictly to 'pickup' and 'delivery' for current dark kitchen operations,
// future evolutions can transition service types into a configurable inventory in manager settings (service type
// toolkit: add, edit, delete, default 'undefined' fallback) with dynamic tenant-level custom fulfillment modes.
export const serviceTypeSchema = z.enum(["pickup", "delivery"]);
export type ServiceType = z.infer<typeof serviceTypeSchema>;

export const channelSchema = z.enum(["storefront", "phone", "whatsapp", "in-person"]);
export type Channel = z.infer<typeof channelSchema>;

export const paymentPreferenceSchema = z.enum(["revolut", "wero", "on_handover"]);
export type PaymentPreference = z.infer<typeof paymentPreferenceSchema>;

export const paymentMethodSchema = z.enum(["cash", "revolut", "wero"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const orderStatusEventSchema = z.object({
  status: orderStatusSchema,
  timestamp: isoDateTimeSchema,
  note: z.string().trim().optional().nullable(),
});
export type OrderStatusEvent = z.infer<typeof orderStatusEventSchema>;

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
  // The guest's name is resolved via guestId (single source of truth), never stored on the order.
  guestId: uuidSchema,
  // Audit only, never displayed as the customer name: filled when the submitted name differs from
  // the stored guest name and the caller was not allowed to rename the guest.
  submittedName: z.string().optional().nullable(),
  serviceType: serviceTypeSchema,
  channel: channelSchema,
  status: orderStatusSchema,
  paid: paidStatusSchema,
  paymentPreference: paymentPreferenceSchema,
  paymentMethod: paymentMethodSchema.optional().nullable(),
  paidAt: isoDateTimeSchema.optional().nullable(),
  refundedAt: isoDateTimeSchema.optional().nullable(),
  requestedDate: isoDateSchema,
  requestedTime: timeHHMMSchema.optional().nullable(),
  items: z.array(orderItemSchema).min(1),
  totalAmount: moneySchema,
  trackingToken: z.string().trim().optional(),
  cancellationReason: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  deliveryAddress: z.string().trim().optional().nullable(),
  statusHistory: z.array(orderStatusEventSchema).optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Order = z.infer<typeof orderSchema>;

// Public lookups must strip private fields, including nested item identifiers.
export const publicOrderSchema = orderSchema
  .pick({
    businessId: true,
    orderNumber: true,
    serviceType: true,
    status: true,
    paid: true,
    paymentPreference: true,
    requestedDate: true,
    requestedTime: true,
    totalAmount: true,
    cancellationReason: true,
    createdAt: true,
  })
  .extend({
    items: z.array(
      orderItemSchema.pick({
        productName: true,
        quantity: true,
        unitPrice: true,
        totalPrice: true,
      }),
    ),
  });
export type PublicOrder = z.infer<typeof publicOrderSchema>;

/** Read model: an order with its guest's current name resolved via guestId. */
export type NamedOrder = Order & { readonly guestName: string };

export const UNKNOWN_GUEST_NAME = "Unknown guest";

/** Resolves each order's guest name from the guest list (the name is never stored on the order). */
export function attachGuestNames(
  orders: readonly Order[],
  guests: readonly Pick<Guest, "id" | "name">[],
): NamedOrder[] {
  const names = new Map(guests.map((g) => [g.id, g.name]));
  return orders.map((o) => ({ ...o, guestName: names.get(o.guestId) ?? UNKNOWN_GUEST_NAME }));
}

export const manualOrderItemInputSchema = z.object({
  productId: uuidSchema,
  quantity: z.number().int().min(1),
});
export type ManualOrderItemInput = z.infer<typeof manualOrderItemInputSchema>;

export const manualOrderInputSchema = z.object({
  guestPhone: z
    .string()
    .trim()
    .min(1)
    .refine((v) => isValidPhoneNumber(v), "Invalid phone number"),
  guestName: guestNameSchema,
  // Explicit manager intent to overwrite the stored name of a matched guest.
  updateGuestName: z.boolean().default(false),
  deliveryAddress: z.string().trim().optional().nullable(),
  serviceType: serviceTypeSchema,
  channel: channelSchema,
  isAsap: z.boolean().default(true),
  requestedDate: isoDateSchema.optional(),
  requestedTime: timeHHMMSchema.optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  paymentPreference: paymentPreferenceSchema.default("on_handover"),
  items: z.array(manualOrderItemInputSchema).min(1),
});
export type ManualOrderInput = z.infer<typeof manualOrderInputSchema>;

export const updateOrderStatusInputSchema = z.object({
  orderId: uuidSchema,
  nextStatus: orderStatusSchema,
  reason: z.string().trim().optional().nullable(),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;

export const recordRefundInputSchema = z.object({
  orderId: uuidSchema,
  reason: z.string().trim().optional().nullable(),
});
export type RecordRefundInput = z.infer<typeof recordRefundInputSchema>;

/** Mirrors the limit enforced by `place_order` in the database (300 characters). */
export const MAX_DELIVERY_ADDRESS_LENGTH = 300;

export const placeOrderRepoItemInputSchema = z.object({
  productId: uuidSchema,
  quantity: z.number().int().min(1),
});
export type PlaceOrderRepoItemInput = z.infer<typeof placeOrderRepoItemInputSchema>;

export const placeOrderRepoInputSchema = z.object({
  guestName: guestNameSchema,
  guestPhone: z
    .string()
    .trim()
    .min(1)
    .refine((v) => isValidPhoneNumber(v), "Invalid phone number"),
  serviceType: serviceTypeSchema,
  channel: channelSchema,
  requestedDate: isoDateSchema,
  requestedTime: timeHHMMSchema.optional().nullable(),
  items: z.array(placeOrderRepoItemInputSchema).min(1),
  paymentPreference: paymentPreferenceSchema.optional(),
  deliveryAddress: z.string().trim().max(MAX_DELIVERY_ADDRESS_LENGTH).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  allowRename: z.boolean().optional(),
  /**
   * Client-generated uuid. A repeated call with the same key (per business) returns the original
   * order instead of creating a second one and does not touch stock again.
   */
  idempotencyKey: uuidSchema.optional(),
});
export type PlaceOrderRepoInput = z.infer<typeof placeOrderRepoInputSchema>;

export const placedOrderSummarySchema = z.object({
  orderId: uuidSchema,
  orderNumber: z.number().int().positive(),
  trackingToken: z.string().trim().min(1),
  submittedName: z.string().optional().nullable(),
  totalAmount: moneySchema,
  /** True when the idempotency key matched an existing order (nothing was created or reserved). */
  replayed: z.boolean().optional(),
});
export type PlacedOrderSummary = z.infer<typeof placedOrderSummarySchema>;

export const cancelOrderResultSchema = z.object({
  orderId: uuidSchema,
  status: orderStatusSchema,
  cancellationReason: z.string().trim().optional().nullable(),
});
export type CancelOrderResult = z.infer<typeof cancelOrderResultSchema>;

export class OrderRepoError extends Error {
  readonly code: string;
  readonly lineErrors?: Record<string, string>;

  constructor(
    message: string,
    code: string = "INTERNAL_ERROR",
    lineErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "OrderRepoError";
    this.code = code;
    this.lineErrors = lineErrors;
  }
}
