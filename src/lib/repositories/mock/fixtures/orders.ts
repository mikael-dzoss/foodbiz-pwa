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
const SERVICES: readonly ServiceType[] = ["pickup", "delivery", "dine-in"];
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
  const paid: "paid" | "unpaid" =
    status === "CANCELLED" || (idx >= 34 && idx % 2 === 1) ? "unpaid" : "paid";

  const serviceType = SERVICES[idx % SERVICES.length];
  const channel = CHANNELS[idx % CHANNELS.length];
  const paymentPreference = PREFERENCES[idx % PREFERENCES.length];
  const paymentMethod =
    paid === "paid" ? (paymentPreference === "on_handover" ? "cash" : paymentPreference) : null;

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
    guestName: guest.name,
    serviceType,
    channel,
    status,
    paid,
    paymentPreference,
    paymentMethod,
    paidAt: paid === "paid" ? createdAt : null,
    requestedDate,
    requestedTime,
    items,
    totalAmount,
    cancellationReason: status === "CANCELLED" ? "Customer requested cancellation" : null,
    notes: idx % 5 === 0 ? "Special handling requested" : null,
    createdAt,
    updatedAt: createdAt,
  };
});
