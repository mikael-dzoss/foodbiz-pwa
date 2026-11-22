import { z } from "zod";

export const orderLookupInputSchema = z.object({
  phone: z.string().trim().min(6).max(30),
  orderNumber: z.coerce.number().int().min(1).max(999999),
  website: z.string().optional(),
});

export type OrderLookupInput = z.infer<typeof orderLookupInputSchema>;

/** Submitted values are echoed back so React's post-action form reset keeps what the customer typed. */
export interface OrderLookupValues {
  readonly phone: string;
  readonly orderNumber: string;
}

export type OrderLookupState =
  | { readonly status: "idle" }
  | {
      readonly status: "error";
      readonly code: "INVALID" | "NOT_FOUND" | "RATE_LIMITED";
      readonly values: OrderLookupValues;
    };

export const INITIAL_ORDER_LOOKUP_STATE: OrderLookupState = { status: "idle" };
