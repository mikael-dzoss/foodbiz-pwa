"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepositories } from "@/lib/repositories";
import { defineAction } from "@/lib/actions/define-action";
import { ActionError } from "@/lib/actions/types";
import { revalidateStorefrontCatalog } from "@/features/storefront/catalog-data";
import {
  type Guest,
  type PlacedOrderSummary,
  type Product,
  manualOrderInputSchema,
  paymentMethodSchema,
  updateOrderStatusInputSchema,
  recordRefundInputSchema,
  validateOrderTransition,
  validateOrderLineStock,
  normalizePhoneNumber,
  uuidSchema,
} from "@/domain";
import { listOrders, listOrdersFilterSchema } from "./order-data";

export type GuestPrefill = Pick<Guest, "id" | "name" | "address">;

const orderIdSchema = z.object({ orderId: uuidSchema });
const orderPaymentSchema = orderIdSchema.extend({ paymentMethod: paymentMethodSchema });

/** Refuses with a vetted message when current state does not allow the change. */
const refuse = (message: string) => new ActionError("CONFLICT", message);

function revalidateOrder(orderId: string) {
  revalidatePath("/manage/orders");
  revalidatePath(`/manage/orders/${orderId}`);
}

async function requireOrder(businessId: string, orderId: string) {
  const order = await getRepositories().orders.findById(businessId, orderId);
  if (!order) throw new ActionError("NOT_FOUND", "Order not found");
  return order;
}

/**
 * Orders for the polling alert badge; pages read through `listOrders` in `order-data.ts` instead.
 */
export const listOrdersAction = defineAction(
  "listOrders",
  { input: listOrdersFilterSchema },
  async ({ input }) => listOrders(input),
);

/** Creates a manual order, decrements stock and links or creates a guest by phone. */
export const createManualOrderAction = defineAction(
  "createManualOrder",
  { input: manualOrderInputSchema },
  async ({ input: data, businessId }) => {
    const repos = getRepositories();

    const productMap = new Map<string, Product>(
      (await repos.products.list(businessId)).map((p) => [p.id, p]),
    );
    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new ActionError("NOT_FOUND", `Product with ID "${item.productId}" was not found.`);
      }
      const check = validateOrderLineStock(product, item.quantity);
      if (!check.ok) throw refuse(check.error.message);
    }

    const todayDate = new Date().toISOString().slice(0, 10);
    const summary: PlacedOrderSummary = await repos.orders.place(businessId, {
      guestName: data.guestName,
      guestPhone: data.guestPhone,
      serviceType: data.serviceType,
      channel: data.channel,
      requestedDate: data.isAsap ? todayDate : (data.requestedDate ?? todayDate),
      requestedTime: data.isAsap ? null : (data.requestedTime ?? null),
      items: data.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
      paymentPreference: data.paymentPreference,
      deliveryAddress: data.deliveryAddress ?? null,
      notes: data.notes ?? null,
      allowRename: data.updateGuestName,
    });

    // Manual orders go straight to CONFIRMED (appends to the history place_order started).
    const order = await repos.orders.transition(businessId, summary.orderId, {
      expectedStatus: "NEW",
      nextStatus: "CONFIRMED",
      reason: `Manual order created via ${data.channel}`,
    });

    revalidatePath("/manage/orders");
    revalidatePath("/manage/products");
    revalidateStorefrontCatalog(businessId);
    return order;
  },
);

/** Moves an order to a valid next status (server-side state machine and timestamp logging). */
export const progressOrderStatusAction = defineAction(
  "progressOrderStatus",
  { input: updateOrderStatusInputSchema },
  async ({ input: { orderId, nextStatus, reason }, businessId }) => {
    const order = await requireOrder(businessId, orderId);
    const validation = validateOrderTransition({
      currentStatus: order.status,
      nextStatus,
      paid: order.paid,
      reason,
    });
    if (!validation.ok) throw refuse(validation.error);

    // One atomic database step: expected-status check, transition table, stock restore on
    // cancellation and the history entry. A concurrent change surfaces as ORDER_STATE_CONFLICT.
    const updated = await getRepositories().orders.transition(businessId, orderId, {
      expectedStatus: order.status,
      nextStatus,
      reason: reason ?? null,
    });

    revalidateOrder(orderId);
    if (nextStatus === "CANCELLED") {
      revalidatePath("/manage/products");
      revalidateStorefrontCatalog(businessId);
    }
    return updated;
  },
);

/** Records payment (any status except CANCELLED or refunded) and sets paid status to 'paid'. */
export const recordPaymentAction = defineAction(
  "recordPayment",
  { input: orderPaymentSchema },
  async ({ input: { orderId, paymentMethod }, businessId }) => {
    const order = await requireOrder(businessId, orderId);
    if (order.status === "CANCELLED") {
      throw refuse("Payment cannot be recorded for a cancelled order.");
    }
    if (order.paid === "refunded") throw refuse("Payment cannot be recorded for a refunded order.");

    const updated = await getRepositories().orders.recordPayment(businessId, orderId, {
      paymentMethod,
    });
    revalidateOrder(orderId);
    return updated;
  },
);

/** Undoes a payment, clearing paymentMethod and paidAt. Blocked if completed, refunded or unpaid. */
export const markOrderUnpaidAction = defineAction(
  "markOrderUnpaid",
  { input: orderIdSchema },
  async ({ input: { orderId }, businessId }) => {
    const order = await requireOrder(businessId, orderId);
    if (order.status === "COMPLETED") throw refuse("Cannot mark a completed order as unpaid.");
    if (order.paid === "refunded") throw refuse("Cannot mark a refunded order as unpaid.");
    if (order.paid === "unpaid") throw refuse("Order is already marked as unpaid.");

    const updated = await getRepositories().orders.markUnpaid(businessId, orderId);
    revalidateOrder(orderId);
    return updated;
  },
);

/** Shortcut for a READY order: records payment and completes it in one step. */
export const markPaidAndCompleteAction = defineAction(
  "markPaidAndComplete",
  { input: orderPaymentSchema },
  async ({ input: { orderId, paymentMethod }, businessId }) => {
    const order = await requireOrder(businessId, orderId);
    if (order.status !== "READY") {
      throw refuse("Order must be in READY status to use Mark Paid & Complete.");
    }
    if (order.paid === "refunded") throw refuse("Cannot complete a refunded order.");

    const updated = await getRepositories().orders.recordPayment(businessId, orderId, {
      paymentMethod,
      markCompleted: true,
    });
    revalidateOrder(orderId);
    return updated;
  },
);

/**
 * Finds an existing guest by phone for instant form prefill (managers only). Returns the minimum
 * needed to prefill the form, not the full guest record.
 */
export const lookupGuestByPhoneAction = defineAction(
  "lookupGuestByPhone",
  { input: z.string() },
  async ({ input: phone, businessId }): Promise<GuestPrefill | null> => {
    if (phone.trim().length < 3) return null;

    let normalized: string;
    try {
      normalized = normalizePhoneNumber(phone);
    } catch {
      normalized = phone.trim();
    }
    const guest = await getRepositories().guests.findByPhone(businessId, normalized);
    return guest ? { id: guest.id, name: guest.name, address: guest.address ?? null } : null;
  },
);

/** Refunds a paid order (owner only): paid status becomes 'refunded' and refundedAt is set. */
export const recordRefundAction = defineAction(
  "recordRefund",
  { auth: "owner", input: recordRefundInputSchema },
  async ({ input: { orderId, reason }, businessId }) => {
    const order = await requireOrder(businessId, orderId);
    if (order.paid === "refunded") throw refuse("Order is already marked as refunded.");
    if (order.paid === "unpaid") throw refuse("Cannot refund an unpaid order.");

    const updated = await getRepositories().orders.recordRefund(
      businessId,
      orderId,
      reason ?? null,
    );
    revalidateOrder(orderId);
    return updated;
  },
);
