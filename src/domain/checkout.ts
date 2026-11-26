import { z } from "zod";
import { isoDateSchema, timeHHMMSchema, uuidSchema } from "./common";
import {
  GUEST_NAME_MAX_LENGTH,
  GUEST_NAME_MIN_LENGTH,
  guestNameSchema,
  isValidPhoneNumber,
} from "./guest";
import { MAX_LINES_PER_ORDER } from "./anti-abuse";
import type { SlotErrorReason } from "./opening-hours";
import {
  MAX_DELIVERY_ADDRESS_LENGTH,
  serviceTypeSchema,
  paymentPreferenceSchema,
  type OrderStatus,
} from "./order";

export const CHECKOUT_FIELD_NAMES = [
  "name",
  "phone",
  "serviceType",
  "deliveryAddress",
  "requestedDate",
  "requestedTime",
  "paymentPreference",
  "notes",
] as const;

export type CheckoutFieldName = (typeof CHECKOUT_FIELD_NAMES)[number];

const CHECKOUT_FIELD_NAME_SET: ReadonlySet<string> = new Set(CHECKOUT_FIELD_NAMES);

function isCheckoutFieldName(value: PropertyKey | undefined): value is CheckoutFieldName {
  return typeof value === "string" && CHECKOUT_FIELD_NAME_SET.has(value);
}

export interface CheckoutFieldIssue {
  readonly code: string;
  readonly path: ReadonlyArray<PropertyKey>;
  readonly message: string;
}

interface CheckoutConditionalInput {
  readonly serviceType?: unknown;
  readonly deliveryAddress?: string | null;
  readonly isAsap?: boolean;
  readonly requestedDate?: string | null;
}

/**
 * Shared conditional checkout rules (delivery address for delivery, date for scheduled orders).
 * Used by both `checkoutFormSchema.superRefine` and `checkoutFieldIssues` so rules live in one place.
 */
function getCheckoutConditionalIssues(
  data: CheckoutConditionalInput,
): ReadonlyArray<CheckoutFieldIssue> {
  const issues: CheckoutFieldIssue[] = [];
  if (data.serviceType === "delivery") {
    const address = typeof data.deliveryAddress === "string" ? data.deliveryAddress.trim() : "";
    if (address.length < 5) {
      issues.push({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Delivery address is required for delivery",
      });
    }
  }
  if (data.isAsap === false && !data.requestedDate) {
    issues.push({
      code: "custom",
      path: ["requestedDate"],
      message: "Please select a date for scheduled orders",
    });
  }
  return issues;
}

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
        error: "Invalid phone number format",
      }),
    serviceType: serviceTypeSchema,
    deliveryAddress: z
      .string()
      .trim()
      .max(MAX_DELIVERY_ADDRESS_LENGTH, "Delivery address must be under 300 characters")
      .optional()
      .nullable(),
    isAsap: z.boolean().default(true),
    requestedDate: isoDateSchema.optional().nullable(),
    requestedTime: timeHHMMSchema.optional().nullable(),
    paymentPreference: paymentPreferenceSchema.default("on_handover"),
    notes: z.string().trim().max(500, "Notes must be under 500 characters").optional().nullable(),
  })
  .superRefine((data, ctx) => {
    for (const issue of getCheckoutConditionalIssues(data)) {
      ctx.addIssue({
        code: "custom",
        path: [...issue.path],
        message: issue.message,
      });
    }
  });

export type CheckoutFormInput = z.input<typeof checkoutFormSchema>;
export type CheckoutFormData = z.infer<typeof checkoutFormSchema>;

export type CheckoutErrorDictKey =
  | "nameRequiredError"
  | "nameTooLongError"
  | "phoneRequiredError"
  | "phoneInvalidError"
  | "addressRequiredError"
  | "addressTooLongError"
  | "dateRequiredError"
  | "dateInvalidError"
  | "timeInvalidError"
  | "notesTooLongError"
  | "fieldInvalidError";

/**
 * Returns the first validation issue per checkout field from `checkoutFormSchema`,
 * including conditional rules (`deliveryAddress`, `requestedDate`) even when Zod skips
 * object-level `.superRefine` because another base field failed.
 */
export function checkoutFieldIssues(
  input: CheckoutFormInput,
  parsedResult: ReturnType<typeof checkoutFormSchema.safeParse> = checkoutFormSchema.safeParse(
    input,
  ),
): Partial<Record<CheckoutFieldName, CheckoutFieldIssue>> {
  if (parsedResult.success) {
    return {};
  }

  const byField: Partial<Record<CheckoutFieldName, CheckoutFieldIssue>> = {};
  const record = (issues: ReadonlyArray<CheckoutFieldIssue>) => {
    for (const issue of issues) {
      const field = issue.path[0];
      if (isCheckoutFieldName(field) && !byField[field]) {
        byField[field] = issue;
      }
    }
  };

  record(parsedResult.error.issues);
  record(getCheckoutConditionalIssues(input));
  return byField;
}

/**
 * Maps a checkout Zod issue to a dictionary key name (framework-free string literal union).
 * Unknown fields or unexpected issue codes fall back to `"fieldInvalidError"`.
 */
export function mapCheckoutIssueToDictKey(
  issue: { readonly path: ReadonlyArray<PropertyKey>; readonly code: string },
  rawName: string,
): CheckoutErrorDictKey {
  const field = issue.path[0];
  switch (field) {
    case "name": {
      if (issue.code !== "custom") return "fieldInvalidError";
      const normalizedLength = [...rawName.trim().replace(/\s+/g, " ").normalize("NFC")].length;
      if (normalizedLength > GUEST_NAME_MAX_LENGTH) return "nameTooLongError";
      if (normalizedLength < GUEST_NAME_MIN_LENGTH) return "nameRequiredError";
      return "fieldInvalidError";
    }
    case "phone":
      if (issue.code === "too_small") return "phoneRequiredError";
      if (issue.code === "custom") return "phoneInvalidError";
      return "fieldInvalidError";
    case "deliveryAddress":
      if (issue.code === "too_big") return "addressTooLongError";
      if (issue.code === "custom") return "addressRequiredError";
      return "fieldInvalidError";
    case "requestedDate":
      if (issue.code === "custom") return "dateRequiredError";
      if (issue.code === "invalid_format") return "dateInvalidError";
      return "fieldInvalidError";
    case "requestedTime":
      if (issue.code === "invalid_format") return "timeInvalidError";
      return "fieldInvalidError";
    case "notes":
      if (issue.code === "too_big") return "notesTooLongError";
      return "fieldInvalidError";
    default:
      return "fieldInvalidError";
  }
}

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
    items: z
      .array(placeOrderItemInputSchema)
      .min(1, "Order must contain at least one item")
      .max(MAX_LINES_PER_ORDER, `An order may contain at most ${MAX_LINES_PER_ORDER} lines`),
    name: guestNameSchema,
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .refine((val) => isValidPhoneNumber(val), {
        error: "Invalid phone number format",
      }),
    serviceType: serviceTypeSchema,
    deliveryAddress: z
      .string()
      .trim()
      .max(MAX_DELIVERY_ADDRESS_LENGTH, "Delivery address must be under 300 characters")
      .optional()
      .nullable(),
    isAsap: z.boolean().default(true),
    requestedDate: isoDateSchema.optional().nullable(),
    requestedTime: timeHHMMSchema.optional().nullable(),
    paymentPreference: paymentPreferenceSchema.default("on_handover"),
    notes: z.string().trim().max(500, "Notes must be under 500 characters").optional().nullable(),
    /** Client-generated uuid; the database stores it on the order to make retries idempotent. */
    idempotencyKey: uuidSchema,
    honeypot: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.serviceType === "delivery") {
      const address = data.deliveryAddress?.trim() ?? "";
      if (address.length < 5) {
        ctx.addIssue({
          code: "custom",
          path: ["deliveryAddress"],
          message: "Delivery address is required for delivery",
        });
      }
    }
    if (!data.isAsap && !data.requestedDate) {
      ctx.addIssue({
        code: "custom",
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

/**
 * Stable `reason` of a refused place-order action (`ActionFailure.reason`); the checkout maps each
 * to a localized message. Failures without one fall back to their action code.
 */
export const PLACE_ORDER_REASONS = [
  "ANTI_ABUSE_REJECTION",
  "STORE_CLOSED",
  "SERVICE_TYPE_DISABLED",
  "MINIMUM_ORDER_UNMET",
  "STOCK_ERROR",
  "SLOT_CLOSED_NOW",
  "SLOT_CLOSED_DAY",
  "SLOT_DATE_OUT_OF_WINDOW",
  "SLOT_TIME_OUTSIDE_HOURS",
  "SLOT_TIME_IN_PAST",
] as const;

export type PlaceOrderReason = (typeof PLACE_ORDER_REASONS)[number];

/** Place-order reason (and repository error code) for each opening-hours slot rejection. */
export const SLOT_ERROR_REASONS = {
  closed_now: "SLOT_CLOSED_NOW",
  closed_day: "SLOT_CLOSED_DAY",
  date_out_of_window: "SLOT_DATE_OUT_OF_WINDOW",
  time_outside_hours: "SLOT_TIME_OUTSIDE_HOURS",
  time_in_past: "SLOT_TIME_IN_PAST",
} as const satisfies Record<SlotErrorReason, PlaceOrderReason>;

/** Client-safe English text per slot rejection (the checkout shows its localized equivalent). */
export const SLOT_ERROR_MESSAGES = {
  closed_now: "The store is closed right now. Please choose a date and time to order for later.",
  closed_day: "The store is closed on the chosen date. Please choose another day.",
  date_out_of_window: "Please choose a date from today up to 30 days ahead.",
  time_outside_hours: "The chosen time is outside the store's opening hours.",
  time_in_past: "The chosen time has already passed. Please choose a later time.",
} as const satisfies Record<SlotErrorReason, string>;
