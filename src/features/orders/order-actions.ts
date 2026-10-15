"use server";

import { revalidatePath } from "next/cache";
import { getRepositories } from "@/lib/repositories";
import { requireAuthenticatedAction } from "@/features/auth";
import {
  type Order,
  type OrderStatus,
  type ServiceType,
  type Guest,
  type Product,
  manualOrderInputSchema,
  updateOrderStatusInputSchema,
  recordRefundInputSchema,
  validateOrderTransition,
  validateOrderLineStock,
  reserveStock,
  restoreStock,
  normalizePhoneNumber,
} from "@/domain";
import { z } from "zod";

export type OrderActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export interface EnrichedOrder extends Order {
  guestPhone?: string | null;
  guestEmail?: string | null;
}

export interface ListOrdersResult {
  orders: EnrichedOrder[];
  counts: {
    active: number;
    completed: number;
    cancelled: number;
    total: number;
    unpaid: number;
    pickup: number;
    delivery: number;
  };
}

export interface ListOrdersFilter {
  statusTab?: "active" | "completed" | "cancelled" | "all";
  serviceType?: ServiceType;
  unpaidOnly?: boolean;
  search?: string;
}

const ACTIVE_STATUSES: readonly OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "READY"];

/**
 * Retrieves orders for the manager's business with search, filtering, and priority sorting.
 */
export async function listOrdersAction(
  filter?: ListOrdersFilter,
): Promise<OrderActionResult<ListOrdersResult>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const repos = getRepositories();

    const [allOrders, allGuests] = await Promise.all([
      repos.orders.list(businessId),
      repos.guests.list(businessId),
    ]);

    const guestMap = new Map<string, Guest>();
    for (const g of allGuests) {
      guestMap.set(g.id, g);
    }

    // Enrich orders with guest phone/email
    const enrichedOrders: EnrichedOrder[] = allOrders.map((o) => {
      const g = o.guestId ? guestMap.get(o.guestId) : undefined;
      return {
        ...o,
        guestPhone: g?.phone ?? null,
        guestEmail: g?.email ?? null,
        deliveryAddress: o.deliveryAddress ?? g?.address ?? null,
      };
    });

    // Compute global counts before tab filtering
    const activeCount = enrichedOrders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
    const completedCount = enrichedOrders.filter((o) => o.status === "COMPLETED").length;
    const cancelledCount = enrichedOrders.filter((o) => o.status === "CANCELLED").length;
    const unpaidCount = enrichedOrders.filter((o) => o.paid === "unpaid").length;
    const pickupCount = enrichedOrders.filter((o) => o.serviceType === "pickup").length;
    const deliveryCount = enrichedOrders.filter((o) => o.serviceType === "delivery").length;

    let filtered = enrichedOrders;

    // Filter by tab: active (default) | completed | cancelled | all
    const tab = filter?.statusTab ?? "active";
    if (tab !== "all") {
      if (tab === "active") {
        filtered = filtered.filter((o) => ACTIVE_STATUSES.includes(o.status));
      } else if (tab === "completed") {
        filtered = filtered.filter((o) => o.status === "COMPLETED");
      } else if (tab === "cancelled") {
        filtered = filtered.filter((o) => o.status === "CANCELLED");
      }
    }

    // Filter by unpaid only
    if (filter?.unpaidOnly) {
      filtered = filtered.filter((o) => o.paid === "unpaid");
    }

    // Filter by service type
    if (filter?.serviceType) {
      filtered = filtered.filter((o) => o.serviceType === filter.serviceType);
    }

    // Filter by search query (name, phone, order reference)
    if (filter?.search && filter.search.trim().length > 0) {
      const query = filter.search.trim().toLowerCase();
      const queryDigits = query.replace(/\D/g, "");

      filtered = filtered.filter((o) => {
        // Order reference e.g. #42 or 42
        const numStr = o.orderNumber ? String(o.orderNumber) : "";
        if (numStr === query || `#${numStr}` === query) return true;
        if (numStr.includes(query)) return true;

        // Guest name
        if (o.guestName.toLowerCase().includes(query)) return true;

        // Guest phone
        if (o.guestPhone && o.guestPhone.toLowerCase().includes(query)) return true;
        if (queryDigits.length >= 3 && o.guestPhone && o.guestPhone.includes(queryDigits)) {
          return true;
        }

        // Tracking token
        if (o.trackingToken && o.trackingToken.toLowerCase().includes(query)) return true;

        return false;
      });
    }

    // Sort: ASAP first, then requested date/time chronologically
    // If an order has no requestedTime, it is treated as ASAP for that date.
    filtered.sort((a, b) => {
      // 1. Prioritize NEW status within active triage
      if (a.status === "NEW" && b.status !== "NEW") return -1;
      if (b.status === "NEW" && a.status !== "NEW") return 1;

      // 2. Sort by requestedDate
      if (a.requestedDate !== b.requestedDate) {
        return a.requestedDate.localeCompare(b.requestedDate);
      }

      // 3. For the same date, ASAP (no requestedTime or null) comes before scheduled times
      if (!a.requestedTime && b.requestedTime) return -1;
      if (a.requestedTime && !b.requestedTime) return 1;
      if (a.requestedTime && b.requestedTime) {
        return a.requestedTime.localeCompare(b.requestedTime);
      }

      // 4. Default to newest creation first
      return b.createdAt.localeCompare(a.createdAt);
    });

    return {
      success: true,
      data: {
        orders: filtered,
        counts: {
          active: activeCount,
          completed: completedCount,
          cancelled: cancelledCount,
          total: enrichedOrders.length,
          unpaid: unpaidCount,
          pickup: pickupCount,
          delivery: deliveryCount,
        },
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list orders";
    return { success: false, error: message };
  }
}

/**
 * Retrieves a single order with its guest details and items.
 */
export async function getOrderAction(
  orderId: string,
): Promise<OrderActionResult<{ order: EnrichedOrder; guest: Guest | null }>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const repos = getRepositories();

    const order = await repos.orders.findById(businessId, orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    let guest: Guest | null = null;
    if (order.guestId) {
      guest = await repos.guests.findById(businessId, order.guestId);
    }

    const enriched: EnrichedOrder = {
      ...order,
      guestPhone: guest?.phone ?? null,
      guestEmail: guest?.email ?? null,
      deliveryAddress: order.deliveryAddress ?? guest?.address ?? null,
    };

    return {
      success: true,
      data: {
        order: enriched,
        guest,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load order";
    return { success: false, error: message };
  }
}

/**
 * Creates a manual order, decrements stock for ordered items, and links or creates a guest by phone.
 */
export async function createManualOrderAction(input: unknown): Promise<OrderActionResult<Order>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const parsed = manualOrderInputSchema.safeParse(input);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        fieldErrors[path] = fieldErrors[path] || [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "Validation failed: please check order details.",
        fieldErrors,
      };
    }

    const data = parsed.data;
    const repos = getRepositories();

    // 1. Phone normalisation & Guest lookup/creation
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(data.guestPhone);
    } catch {
      normalizedPhone = data.guestPhone.trim();
    }

    let guest = await repos.guests.findByPhone(businessId, normalizedPhone);
    if (!guest) {
      guest = await repos.guests.create(businessId, {
        name: data.guestName,
        phone: normalizedPhone,
        address: data.deliveryAddress ?? null,
      });
    }

    // 2. Validate product availability and stock
    const allProducts = await repos.products.list(businessId);
    const productMap = new Map<string, Product>();
    for (const p of allProducts) {
      productMap.set(p.id, p);
    }

    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return {
          success: false,
          error: `Product with ID "${item.productId}" was not found.`,
        };
      }
      const check = validateOrderLineStock(product, item.quantity);
      if (!check.ok) {
        return { success: false, error: check.error.message };
      }
    }

    // 3. Decrement stock for all items
    for (const item of data.items) {
      const product = productMap.get(item.productId)!;
      const reservation = reserveStock(product, item.quantity);
      if (!reservation.ok) {
        return { success: false, error: reservation.error.message };
      }
      await repos.products.update(businessId, product.id, {
        stock: reservation.remainingStock,
      });
    }

    // 4. Build OrderItems and calculate totals
    const orderItems = data.items.map((it) => {
      const p = productMap.get(it.productId)!;
      return {
        id: crypto.randomUUID(),
        productId: p.id,
        productName: p.name,
        quantity: it.quantity,
        unitPrice: p.price,
        totalPrice: p.price * it.quantity,
      };
    });

    const totalAmount = orderItems.reduce((acc, it) => acc + it.totalPrice, 0);
    const now = new Date().toISOString();
    const todayDate = now.slice(0, 10);
    const requestedDate = data.isAsap ? todayDate : (data.requestedDate ?? todayDate);
    const requestedTime = data.isAsap ? null : (data.requestedTime ?? null);

    // 5. Create Order as CONFIRMED
    const order = await repos.orders.create(businessId, {
      guestId: guest.id,
      guestName: data.guestName,
      serviceType: data.serviceType,
      channel: data.channel,
      status: "CONFIRMED",
      paid: "unpaid",
      paymentPreference: data.paymentPreference,
      requestedDate,
      requestedTime,
      items: orderItems,
      totalAmount,
      notes: data.notes ?? null,
      deliveryAddress: data.deliveryAddress ?? guest.address ?? null,
      statusHistory: [
        {
          status: "CONFIRMED",
          timestamp: now,
          note: `Manual order created via ${data.channel}`,
        },
      ],
    });

    revalidatePath("/manage/orders");
    revalidatePath("/manage/products");

    return { success: true, data: order };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create manual order";
    return { success: false, error: message };
  }
}

/**
 * Transitions an order to its next valid status with server-side validation and timestamp logging.
 */
export async function progressOrderStatusAction(input: unknown): Promise<OrderActionResult<Order>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const parsed = updateOrderStatusInputSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid status transition request.",
      };
    }

    const { orderId, nextStatus, reason } = parsed.data;
    const repos = getRepositories();

    const order = await repos.orders.findById(businessId, orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Validate state machine rules
    const validation = validateOrderTransition({
      currentStatus: order.status,
      nextStatus,
      paid: order.paid,
      reason,
    });

    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    const now = new Date().toISOString();
    const history = [
      ...(order.statusHistory ?? [
        { status: order.status, timestamp: order.createdAt, note: null },
      ]),
      {
        status: nextStatus,
        timestamp: now,
        note: reason ?? null,
      },
    ];

    // If cancelling, restore stock for items
    if (nextStatus === "CANCELLED" && order.status !== "CANCELLED") {
      for (const item of order.items) {
        const prod = await repos.products.findById(businessId, item.productId);
        if (prod) {
          const restored = restoreStock(prod, item.quantity);
          if (restored.ok) {
            await repos.products.update(businessId, prod.id, {
              stock: restored.updatedStock,
            });
          }
        }
      }
    }

    const updated = await repos.orders.update(businessId, orderId, {
      status: nextStatus,
      cancellationReason:
        nextStatus === "CANCELLED"
          ? (reason ?? order.cancellationReason)
          : order.cancellationReason,
      statusHistory: history,
    });

    revalidatePath("/manage/orders");
    revalidatePath(`/manage/orders/${orderId}`);

    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update order status";
    return { success: false, error: message };
  }
}

const recordPaymentInputSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: z.enum(["cash", "revolut", "wero"]),
});

const markOrderUnpaidInputSchema = z.object({
  orderId: z.string().uuid(),
});

const markPaidAndCompleteInputSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: z.enum(["cash", "revolut", "wero"]),
});

/**
 * Records payment for an order and sets paid status to 'paid'.
 * Fails if order is CANCELLED per AC: Payment can be recorded at any status except CANCELLED.
 */
export async function recordPaymentAction(input: unknown): Promise<OrderActionResult<Order>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const parsed = recordPaymentInputSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Invalid payment parameters." };
    }

    const { orderId, paymentMethod } = parsed.data;
    const repos = getRepositories();

    const order = await repos.orders.findById(businessId, orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.status === "CANCELLED") {
      return {
        success: false,
        error: "Payment cannot be recorded for a cancelled order.",
      };
    }

    const now = new Date().toISOString();
    const updated = await repos.orders.update(businessId, orderId, {
      paid: "paid",
      paymentMethod,
      paidAt: now,
    });

    revalidatePath("/manage/orders");
    revalidatePath(`/manage/orders/${orderId}`);

    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record payment";
    return { success: false, error: message };
  }
}

/**
 * Marks a paid order as unpaid (undo), clearing paymentMethod and paidAt.
 * Blocks if order is COMPLETED, refunded, or already unpaid.
 */
export async function markOrderUnpaidAction(input: unknown): Promise<OrderActionResult<Order>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const parsed = markOrderUnpaidInputSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Invalid order parameters." };
    }

    const { orderId } = parsed.data;
    const repos = getRepositories();

    const order = await repos.orders.findById(businessId, orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.status === "COMPLETED") {
      return { success: false, error: "Cannot mark a completed order as unpaid." };
    }

    if (order.paid === "refunded") {
      return { success: false, error: "Cannot mark a refunded order as unpaid." };
    }

    if (order.paid === "unpaid") {
      return { success: false, error: "Order is already marked as unpaid." };
    }

    const now = new Date().toISOString();
    const history: Array<{ status: OrderStatus; timestamp: string; note?: string | null }> = [
      ...(order.statusHistory ?? [
        { status: order.status, timestamp: order.createdAt, note: null },
      ]),
      {
        status: order.status,
        timestamp: now,
        note: "Payment marked as unpaid (undone)",
      },
    ];

    const updated = await repos.orders.update(businessId, orderId, {
      paid: "unpaid",
      paymentMethod: null,
      paidAt: null,
      statusHistory: history,
    });

    revalidatePath("/manage/orders");
    revalidatePath(`/manage/orders/${orderId}`);

    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark order as unpaid";
    return { success: false, error: message };
  }
}

/**
 * Shortcut when order is in READY status: records payment and immediately transitions status to COMPLETED.
 */
export async function markPaidAndCompleteAction(input: unknown): Promise<OrderActionResult<Order>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const parsed = markPaidAndCompleteInputSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Invalid parameters for mark paid and complete." };
    }

    const { orderId, paymentMethod } = parsed.data;
    const repos = getRepositories();

    const order = await repos.orders.findById(businessId, orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.status !== "READY") {
      return {
        success: false,
        error: "Order must be in READY status to use Mark Paid & Complete.",
      };
    }

    const now = new Date().toISOString();
    const history: Array<{ status: OrderStatus; timestamp: string; note?: string | null }> = [
      ...(order.statusHistory ?? [
        { status: order.status, timestamp: order.createdAt, note: null },
      ]),
      {
        status: "COMPLETED" as const,
        timestamp: now,
        note: `Paid via ${paymentMethod} and completed`,
      },
    ];

    const updated = await repos.orders.update(businessId, orderId, {
      paid: "paid",
      paymentMethod,
      paidAt: now,
      status: "COMPLETED",
      statusHistory: history,
    });

    revalidatePath("/manage/orders");
    revalidatePath(`/manage/orders/${orderId}`);

    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark paid and complete order";
    return { success: false, error: message };
  }
}

/**
 * Looks up an existing guest by phone number for instant form prefill.
 */
export async function lookupGuestByPhoneAction(
  phone: string,
): Promise<OrderActionResult<Guest | null>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const repos = getRepositories();

    if (!phone || phone.trim().length < 3) {
      return { success: true, data: null };
    }

    let normalized: string;
    try {
      normalized = normalizePhoneNumber(phone);
    } catch {
      normalized = phone.trim();
    }

    const guest = await repos.guests.findByPhone(businessId, normalized);
    return { success: true, data: guest };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Guest lookup failed";
    return { success: false, error: message };
  }
}

/**
 * Records a refund for an order, transitioning paid status to 'refunded' and capturing refundedAt.
 */
export async function recordRefundAction(input: unknown): Promise<OrderActionResult<Order>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const parsed = recordRefundInputSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Invalid refund parameters." };
    }

    const { orderId, reason } = parsed.data;
    const repos = getRepositories();

    const order = await repos.orders.findById(businessId, orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.paid === "refunded") {
      return { success: false, error: "Order is already marked as refunded." };
    }

    if (order.paid === "unpaid") {
      return { success: false, error: "Cannot refund an unpaid order." };
    }

    const now = new Date().toISOString();
    const history = [
      ...(order.statusHistory ?? [
        { status: order.status, timestamp: order.createdAt, note: null },
      ]),
      {
        status: order.status,
        timestamp: now,
        note: reason ? `Refund recorded: ${reason}` : "Refund recorded",
      },
    ];

    const updated = await repos.orders.update(businessId, orderId, {
      paid: "refunded",
      refundedAt: now,
      statusHistory: history,
    });

    revalidatePath("/manage/orders");
    revalidatePath(`/manage/orders/${orderId}`);

    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record refund";
    return { success: false, error: message };
  }
}
