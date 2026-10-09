import { isoDateTimeSchema } from "./common";
import {
  paymentMethodSchema,
  type OrderStatus,
  type PaidStatus,
  type PaymentMethod,
} from "./order";

export type PaymentResult<T> = { ok: true; order: T } | { ok: false; error: string };

export type OrderPaymentFields = {
  paid: PaidStatus;
  paymentMethod?: PaymentMethod | null;
  paidAt?: string | null;
};

export interface MarkPaidInput {
  paymentMethod: PaymentMethod;
  paidAt?: string;
}

/**
 * Payment status can change independently of order status (before or after delivery).
 */
export function canChangePaymentStatus(orderStatus: OrderStatus): boolean {
  // Payment status can change independently of order status (before or after delivery).
  return Boolean(orderStatus);
}

/**
 * Marks an order as paid with a required payment method and timestamp.
 */
export function markOrderPaid<T extends OrderPaymentFields>(
  order: T,
  input: MarkPaidInput,
): PaymentResult<T> {
  const methodParsed = paymentMethodSchema.safeParse(input.paymentMethod);
  if (!methodParsed.success) {
    return {
      ok: false,
      error:
        "A valid payment method ('cash' | 'revolut' | 'wero') is required when marking an order as paid.",
    };
  }

  let paidAtTimestamp: string;
  if (input.paidAt !== undefined) {
    const paidAtParsed = isoDateTimeSchema.safeParse(input.paidAt);
    if (!paidAtParsed.success) {
      return {
        ok: false,
        error: "paidAt must be a valid ISO datetime string.",
      };
    }
    paidAtTimestamp = paidAtParsed.data;
  } else {
    paidAtTimestamp = new Date().toISOString();
  }

  return {
    ok: true,
    order: {
      ...order,
      paid: "paid",
      paymentMethod: methodParsed.data,
      paidAt: paidAtTimestamp,
    },
  };
}

/**
 * Marks an order as unpaid, clearing paymentMethod and paidAt.
 */
export function markOrderUnpaid<T extends OrderPaymentFields>(order: T): PaymentResult<T> {
  return {
    ok: true,
    order: {
      ...order,
      paid: "unpaid",
      paymentMethod: null,
      paidAt: null,
    },
  };
}

/**
 * Validates the consistency of payment fields on an order.
 */
export function validatePaymentState(
  order: OrderPaymentFields,
): { ok: true } | { ok: false; error: string } {
  if (order.paid === "paid") {
    if (!order.paymentMethod || !paymentMethodSchema.safeParse(order.paymentMethod).success) {
      return {
        ok: false,
        error: "A valid payment method is required for paid orders.",
      };
    }
    if (!order.paidAt || !isoDateTimeSchema.safeParse(order.paidAt).success) {
      return {
        ok: false,
        error: "A valid paidAt timestamp is required for paid orders.",
      };
    }
  }
  return { ok: true };
}
