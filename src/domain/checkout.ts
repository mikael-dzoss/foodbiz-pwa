import { z } from "zod";
import { isoDateSchema, timeHHMMSchema, uuidSchema } from "./common";
import { guestNameSchema, isValidPhoneNumber } from "./guest";
import { serviceTypeSchema, paymentPreferenceSchema, type OrderStatus } from "./order";

/**
 * Schema for customer checkout form inputs (Issue #86).
 * Enforces single name normalization (2-50 chars NFC), E.164 phone syntax,
 * conditional delivery address validation, and timing validation.
 */
export const checkoutFormSchema = z
  .object({
    name: guestNameSchema,
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .refine((val) => isValidPhoneNumber(val), {
        message: "Invalid phone number format",
      }),
    serviceType: serviceTypeSchema,
    deliveryAddress: z.string().trim().optional().nullable(),
    isAsap: z.boolean().default(true),
    requestedDate: isoDateSchema.optional().nullable(),
    requestedTime: timeHHMMSchema.optional().nullable(),
    paymentPreference: paymentPreferenceSchema.default("on_handover"),
    notes: z.string().trim().max(500, "Notes must be under 500 characters").optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.serviceType === "delivery") {
      const address = data.deliveryAddress?.trim() ?? "";
      if (address.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deliveryAddress"],
          message: "Delivery address is required for delivery",
        });
      }
    }
    if (!data.isAsap && !data.requestedDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestedDate"],
        message: "Please select a date for scheduled orders",
      });
    }
  });

export type CheckoutFormInput = z.input<typeof checkoutFormSchema>;
export type CheckoutFormData = z.infer<typeof checkoutFormSchema>;

/**
 * Storage schema for remembering guest contact on device (localStorage)
 * without performing database lookups (zero PII enumeration).
 */
export const GUEST_CONTACT_STORAGE_KEY = "foodbiz_guest_contact";

export const guestContactStorageSchema = z.object({
  name: z.string().trim().min(2).max(50),
  phone: z.string().trim().min(6).max(20),
});

export type GuestContactStorage = z.infer<typeof guestContactStorageSchema>;

/**
 * Line item schema for placing an order from the customer storefront.
 * Client prices are intentionally NOT accepted here; prices are pulled server-side from DB.
 */
export const placeOrderItemInputSchema = z.object({
  productId: uuidSchema,
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

export type PlaceOrderItemInput = z.infer<typeof placeOrderItemInputSchema>;

/**
 * Input schema for placing a storefront order (Issue #87, #90).
 * Re-validates customer info, timing, delivery address, idempotency key, and honeypot.
 */
export const placeOrderInputSchema = z
  .object({
    businessId: uuidSchema.optional(),
    items: z.array(placeOrderItemInputSchema).min(1, "Order must contain at least one item"),
    name: guestNameSchema,
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .refine((val) => isValidPhoneNumber(val), {
        message: "Invalid phone number format",
      }),
    serviceType: serviceTypeSchema,
    deliveryAddress: z.string().trim().optional().nullable(),
    isAsap: z.boolean().default(true),
    requestedDate: isoDateSchema.optional().nullable(),
    requestedTime: timeHHMMSchema.optional().nullable(),
    paymentPreference: paymentPreferenceSchema.default("on_handover"),
    notes: z.string().trim().max(500, "Notes must be under 500 characters").optional().nullable(),
    idempotencyKey: z
      .string()
      .trim()
      .min(8, "Idempotency key is required")
      .max(64, "Idempotency key too long"),
    honeypot: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.serviceType === "delivery") {
      const address = data.deliveryAddress?.trim() ?? "";
      if (address.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deliveryAddress"],
          message: "Delivery address is required for delivery",
        });
      }
    }
    if (!data.isAsap && !data.requestedDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestedDate"],
        message: "Please select a date for scheduled orders",
      });
    }
  });

export type PlaceOrderInput = z.infer<typeof placeOrderInputSchema>;

/**
 * Merges lines sharing a productId (summing quantities, keeping first-seen order) so stock
 * validation, reservation and quantity caps operate on one line per product.
 */
export function mergeDuplicateItems(
  items: ReadonlyArray<PlaceOrderItemInput>,
): PlaceOrderItemInput[] {
  const totals = new Map<string, number>();
  for (const { productId, quantity } of items) {
    totals.set(productId, (totals.get(productId) ?? 0) + quantity);
  }
  return Array.from(totals, ([productId, quantity]) => ({ productId, quantity }));
}

export interface PlaceOrderSuccessData {
  readonly orderId: string;
  readonly orderNumber?: number;
  readonly trackingToken?: string;
  readonly status: OrderStatus;
  readonly totalAmount: number;
}

export const PLACE_ORDER_ERROR_CODES = [
  "VALIDATION_ERROR",
  "ANTI_ABUSE_REJECTION",
  "STORE_CLOSED",
  "SERVICE_TYPE_DISABLED",
  "MINIMUM_ORDER_UNMET",
  "STOCK_ERROR",
  "INTERNAL_ERROR",
] as const;

export type PlaceOrderErrorCode = (typeof PLACE_ORDER_ERROR_CODES)[number];

export type PlaceOrderResult =
  | { readonly success: true; readonly data: PlaceOrderSuccessData }
  | {
      readonly success: false;
      readonly error: string;
      readonly code?: PlaceOrderErrorCode;
      readonly fieldErrors?: Record<string, string[]>;
      readonly lineErrors?: Record<string, string>;
    };
