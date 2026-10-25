import { z } from "zod";
import { isoDateSchema, timeHHMMSchema } from "./common";
import { guestNameSchema, isValidPhoneNumber } from "./guest";
import { serviceTypeSchema, paymentPreferenceSchema } from "./order";

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
