import type { Channel, Order, OrderStatus, PaymentPreference, ServiceType } from "@/domain/order";
import { DEMO_BUSINESS_ID } from "./business";
import { demoGuests } from "./guests";
import { demoProducts } from "./products";

const STATUSES: readonly OrderStatus[] = [
  "COMPLETED",
  "COMPLETED",
  "COMPLETED",
  "COMPLETED",
  "CANCELLED",
  "COMPLETED",
  "COMPLETED",
  "COMPLETED",
  "READY",
  "PREPARING",
  "CONFIRMED",
  "NEW",
];

const CHANNELS: readonly Channel[] = ["storefront", "phone", "whatsapp", "in-person"];
const SERVICES: readonly ServiceType[] = ["pickup", "delivery"];
const PREFERENCES: readonly PaymentPreference[] = ["on_handover", "revolut", "wero"];

const BASE_TIMESTAMP = Date.UTC(2026, 9, 9, 12, 0, 0); // 2026-10-09T12:00:00Z

export const demoOrders: Order[] = Array.from({ length: 40 }, (_, idx) => {
  const orderNumber = idx + 1;
  const idSuffix = String(orderNumber).padStart(2, "0");
  const id = `66666666-6666-4666-8666-6666666666${idSuffix}`;

  // Distribute over 58 days deterministically
  const dayOffset = Math.round(((40 - orderNumber) / 39) * 58);
  const hour = 8 + (orderNumber % 10);
  const minute = (orderNumber * 15) % 60;

  const guest = demoGuests[idx % demoGuests.length];
  const status: OrderStatus =
    idx < 30 ? (idx % 7 === 4 ? "CANCELLED" : "COMPLETED") : STATUSES[idx % STATUSES.length];
  const isCompleted = status === "COMPLETED";
  const isCancelled = status === "CANCELLED";
  const paid: "paid" | "unpaid" | "refunded" = isCancelled
    ? idx % 3 === 0
      ? "paid"
      : idx % 3 === 1
        ? "refunded"
        : "unpaid"
    : isCompleted
      ? idx === 6
        ? "refunded"
        : "paid"
      : idx % 2 === 1
        ? "unpaid"
        : "paid";

  const serviceType = SERVICES[idx % SERVICES.length];
  const channel = CHANNELS[idx % CHANNELS.length];
  const paymentPreference = PREFERENCES[idx % PREFERENCES.length];
  const paymentMethod =
    paid === "paid" || paid === "refunded"
      ? paymentPreference === "on_handover"
        ? "cash"
        : paymentPreference
      : null;

  const orderMs = BASE_TIMESTAMP - dayOffset * 86_400_000;
  const orderDate = new Date(orderMs);
  const yyyy = orderDate.getUTCFullYear();
  const mm = String(orderDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(orderDate.getUTCDate()).padStart(2, "0");
  const requestedDate = `${yyyy}-${mm}-${dd}`;
  const hh = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  const requestedTime = `${hh}:${min}`;
  const createdAt = `${requestedDate}T${hh}:${min}:00.000Z`;
  const t0 = new Date(createdAt).getTime();
  const toIso = (ms: number) => new Date(ms).toISOString();

  // Realistic step progression with gradual timestamps
  const statusHistory = (() => {
    const baseNew = {
      status: "NEW" as const,
      timestamp: toIso(t0),
      note: `Order placed via ${channel}`,
    };
    if (status === "NEW") return [baseNew];

    const baseConfirmed = {
      status: "CONFIRMED" as const,
      timestamp: toIso(t0 + 5 * 60_000),
      note: "Order confirmed by kitchen",
    };
    if (status === "CONFIRMED") return [baseNew, baseConfirmed];

    const basePreparing = {
      status: "PREPARING" as const,
      timestamp: toIso(t0 + 15 * 60_000),
      note: "Kitchen started preparation",
    };
    if (status === "PREPARING") return [baseNew, baseConfirmed, basePreparing];

    const baseReady = {
      status: "READY" as const,
      timestamp: toIso(t0 + 35 * 60_000),
      note: `Order packed and ready for ${serviceType}`,
    };
    if (status === "READY") return [baseNew, baseConfirmed, basePreparing, baseReady];

    if (status === "COMPLETED") {
      const completedEvents = [
        baseNew,
        baseConfirmed,
        basePreparing,
        baseReady,
        {
          status: "COMPLETED" as const,
          timestamp: toIso(t0 + 50 * 60_000),
          note: "Order handed over to customer",
        },
      ];
      if (paid === "refunded") {
        completedEvents.push({
          status: "COMPLETED" as const,
          timestamp: toIso(t0 + 60 * 60_000),
          note: "Post-delivery refund issued for dispute",
        });
      }
      return completedEvents;
    }

    // CANCELLED
    const cancelledEvents: {
      status: "NEW" | "CANCELLED";
      timestamp: string;
      note: string | null;
    }[] = [
      baseNew,
      {
        status: "CANCELLED" as const,
        timestamp: toIso(t0 + 8 * 60_000),
        note: "Customer requested cancellation",
      },
    ];
    if (paid === "refunded") {
      cancelledEvents.push({
        status: "CANCELLED" as const,
        timestamp: toIso(t0 + 15 * 60_000),
        note: "Refund issued to customer",
      });
    }
    return cancelledEvents;
  })();

  const p1 = demoProducts[idx % demoProducts.length];
  const p2 = demoProducts[(idx + 5) % demoProducts.length];
  const itemConfigs =
    idx % 3 === 0
      ? [{ product: p1, qty: 1 }]
      : [
          { product: p1, qty: (idx % 3) + 1 },
          { product: p2, qty: 1 },
        ];

  const items = itemConfigs.map(({ product, qty }, itemIdx) => ({
    id: `77777777-7777-4777-8777-77777777${idSuffix}${String(itemIdx + 1).padStart(2, "0")}`,
    productId: product.id,
    productName: product.name,
    quantity: qty,
    unitPrice: product.price,
    totalPrice: product.price * qty,
  }));

  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return {
    id,
    businessId: DEMO_BUSINESS_ID,
    orderNumber,
    guestId: guest.id,
    serviceType,
    channel,
    status,
    paid,
    paymentPreference,
    paymentMethod,
    paidAt:
      paid === "paid" || paid === "refunded" ? toIso(isCompleted ? t0 + 45 * 60_000 : t0) : null,
    refundedAt:
      paid === "refunded" ? toIso(isCompleted ? t0 + 60 * 60_000 : t0 + 15 * 60_000) : null,
    requestedDate,
    requestedTime,
    items,
    totalAmount,
    trackingToken: `tk-${orderNumber}`,
    cancellationReason: status === "CANCELLED" ? "Customer requested cancellation" : null,
    notes: idx % 5 === 0 ? "Special handling requested" : null,
    deliveryAddress:
      serviceType === "delivery" ? (guest.address ?? "123 Rue de la Paix, Paris") : null,
    statusHistory,
    createdAt,
    updatedAt: statusHistory[statusHistory.length - 1]?.timestamp ?? createdAt,
  };
});
