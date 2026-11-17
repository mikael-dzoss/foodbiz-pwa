import "server-only";

import { z } from "zod";
import { getRepositories } from "@/lib/repositories";
import { requireAuthenticatedAction } from "@/features/auth";
import {
  type NamedOrder,
  type OrderStatus,
  type Guest,
  serviceTypeSchema,
  uuidSchema,
  UNKNOWN_GUEST_NAME,
} from "@/domain";

export interface EnrichedOrder extends NamedOrder {
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

export const listOrdersFilterSchema = z
  .object({
    statusTab: z.enum(["active", "completed", "cancelled", "all"]).optional(),
    serviceType: serviceTypeSchema.optional(),
    unpaidOnly: z.boolean().optional(),
    search: z.string().optional(),
  })
  .optional();

export type ListOrdersFilter = z.infer<typeof listOrdersFilterSchema>;

const ACTIVE_STATUSES: readonly OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "READY"];

/**
 * Orders for the manager's business with search, filtering and priority sorting. Read errors
 * throw to the route error boundary.
 */
export async function listOrders(filter?: ListOrdersFilter): Promise<ListOrdersResult> {
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

  // Enrich orders with guest name/phone/email (name is resolved via guestId, never stored)
  const enrichedOrders: EnrichedOrder[] = allOrders.map((o) => {
    const g = guestMap.get(o.guestId);
    return {
      ...o,
      guestName: g?.name ?? UNKNOWN_GUEST_NAME,
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

      // Guest name or submittedName mismatch
      if (o.guestName.toLowerCase().includes(query)) return true;
      if (o.submittedName && o.submittedName.toLowerCase().includes(query)) return true;

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
  };
}

/** A single order with its guest, or null when the id is malformed or unknown to this business. */
export async function getOrder(
  orderId: string,
): Promise<{ order: EnrichedOrder; guest: Guest | null } | null> {
  const { businessId } = await requireAuthenticatedAction();
  const parsedId = uuidSchema.safeParse(orderId);
  if (!parsedId.success) return null;
  const repos = getRepositories();

  const order = await repos.orders.findById(businessId, parsedId.data);
  if (!order) return null;

  const guest = await repos.guests.findById(businessId, order.guestId);
  return {
    order: {
      ...order,
      guestName: guest?.name ?? UNKNOWN_GUEST_NAME,
      guestPhone: guest?.phone ?? null,
      guestEmail: guest?.email ?? null,
      deliveryAddress: order.deliveryAddress ?? guest?.address ?? null,
    },
    guest,
  };
}
