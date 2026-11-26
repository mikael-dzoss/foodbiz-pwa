"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions/define-action";
import { ActionError } from "@/lib/actions/types";
import { revalidateStorefrontCatalog } from "./catalog-data";
import { getStorefrontBusinessId, getStorefrontRepositories } from "@/lib/repositories/storefront";
import {
  mergeDuplicateItems,
  placeOrderInputSchema,
  SLOT_ERROR_MESSAGES,
  SLOT_ERROR_REASONS,
  type PlaceOrderReason,
  type PlaceOrderSuccessData,
} from "@/domain/checkout";
import {
  validateHoneypot,
  validateOrderQuantities,
  RATE_LIMIT_IP_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "@/domain/anti-abuse";
import {
  DEFAULT_TIMEZONE,
  getZonedDay,
  normalizePhoneNumber,
  type PlacedOrderSummary,
  type Product,
} from "@/domain";
import { validateSlot } from "@/domain/opening-hours";
import { validateOrderStock } from "@/domain/stock";
import { calculateOrderTotals, type PricingLineItem } from "@/domain/pricing";
import { logAntiAbuseRejection } from "@/lib/anti-abuse-log";
import { getGlobalRateLimiter } from "@/lib/rate-limiter";

/** A refusal the checkout shows as one of its localized messages (`reason`, see PlaceOrderReason). */
const reject = (
  code: ConstructorParameters<typeof ActionError>[0],
  reason: PlaceOrderReason,
  message: string,
  extra: { lineErrors?: Record<string, string>; fieldErrors?: Record<string, string[]> } = {},
) => new ActionError(code, message, { reason, ...extra });

/**
 * Public customer storefront action for placing an order (Issues #87, #90).
 * Hardened with honeypot verification, a per-IP rate limit (cheap first layer; the database
 * cannot trust client IP headers), max line/order caps, authoritative server-side price
 * recalculation, atomic stock reservation with rollback and blind guest linkage (zero PII
 * leakage). The per-phone and per-business rate limits, the quantity caps and idempotent replay
 * (`idempotencyKey`) are enforced by the database inside `place_order`, so they also hold across
 * server instances and for callers that bypass this action.
 */
export const placeOrderAction = defineAction(
  "placeOrder",
  { auth: "public", input: placeOrderInputSchema },
  async ({ input: data }): Promise<PlaceOrderSuccessData> => {
    const reqHeaders = await headers();
    const rawForwarded = reqHeaders.get("x-forwarded-for");
    // No shared fallback bucket: unknown IPs must not be able to lock each other out.
    const clientIp = (rawForwarded?.split(",")[0] ?? reqHeaders.get("x-real-ip"))?.trim() || null;

    const businessId = getStorefrontBusinessId();
    // One line per product so stock checks, reservations and caps cannot be bypassed by repeating a line.
    const items = mergeDuplicateItems(data.items);

    // 1. Anti-Abuse: Honeypot check
    if (!validateHoneypot(data.honeypot).ok) {
      logAntiAbuseRejection({ reason: "honeypot", ip: clientIp, phone: data.phone });
      throw reject(
        "FORBIDDEN",
        "ANTI_ABUSE_REJECTION",
        "Order submission rejected by security filter.",
      );
    }

    // 2. Anti-Abuse: Quantity caps per line (<= 50) and per order (<= 100)
    const quantityCheck = validateOrderQuantities(items);
    if (!quantityCheck.ok) {
      logAntiAbuseRejection({
        reason:
          quantityCheck.code === "MAX_LINE_QUANTITY_EXCEEDED"
            ? "max_line_quantity"
            : "max_order_quantity",
        ip: clientIp,
        phone: data.phone,
      });
      throw reject("VALIDATION", "ANTI_ABUSE_REJECTION", quantityCheck.message, {
        lineErrors: quantityCheck.productId
          ? { [quantityCheck.productId]: quantityCheck.message }
          : undefined,
      });
    }

    // 3. Normalize phone number for rate limiting and guest matching
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(data.phone);
    } catch {
      throw new ActionError("VALIDATION", "Invalid phone number format.", {
        fieldErrors: { phone: ["Invalid phone number format"] },
      });
    }

    // 4. Anti-Abuse: per-IP rate limiting (per-phone and per-business limits live in the database)
    const rateLimiter = getGlobalRateLimiter();
    const ipCheck = clientIp
      ? rateLimiter.check(`ip:${clientIp}`, RATE_LIMIT_IP_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)
      : null;
    if (ipCheck && !ipCheck.allowed) {
      logAntiAbuseRejection({ reason: "rate_limit_ip", ip: clientIp, phone: normalizedPhone });
      throw reject(
        "RATE_LIMITED",
        "ANTI_ABUSE_REJECTION",
        "Too many order attempts. Please wait a few minutes before trying again.",
      );
    }

    const repos = getStorefrontRepositories();

    // The requested date defaults to today on the business calendar, not the server's (UTC) one.
    const [business, settings] = await Promise.all([
      repos.business.findById(businessId),
      repos.business.getSettings(businessId),
    ]);

    // 5. Order request for the repository (also used to replay a retry, see rejectOrReplay)
    // place_order enforces the same slot rules (booking window and opening hours in the business
    // timezone), see validateSlot below.
    const todayDate = getZonedDay(new Date(), settings?.timezone ?? DEFAULT_TIMEZONE);
    const placeInput = {
      guestName: data.name,
      guestPhone: normalizedPhone,
      serviceType: data.serviceType,
      channel: "storefront" as const,
      requestedDate: data.isAsap ? todayDate : (data.requestedDate ?? todayDate),
      requestedTime: data.isAsap ? null : (data.requestedTime ?? null),
      items: items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
      paymentPreference: data.paymentPreference,
      deliveryAddress: data.deliveryAddress ?? null,
      notes: data.notes ?? null,
      allowRename: false,
      isAsap: data.isAsap,
      // The database returns the original order for a repeated key (no second order, no second
      // stock decrement), also across server instances.
      idempotencyKey: data.idempotencyKey,
    };

    const succeed = (summary: PlacedOrderSummary): PlaceOrderSuccessData => {
      if (summary.replayed) {
        // A retry of an order that already exists: nothing was created, so it does not count
        // against the per-IP budget and there is nothing to revalidate.
        if (clientIp) rateLimiter.release(`ip:${clientIp}`);
      } else {
        // New order: stock changed on the public catalog and the manager lists.
        revalidateStorefrontCatalog(businessId);
        revalidatePath("/manage/orders");
        revalidatePath("/manage/products");
      }
      return {
        orderId: summary.orderId,
        orderNumber: summary.orderNumber,
        trackingToken: summary.trackingToken,
        status: "NEW",
        totalAmount: summary.totalAmount,
      };
    };

    /**
     * The pre-checks below read current stock and settings, so a retry of an order that already
     * succeeded (and took the last unit) would be reported as a failure. Before refusing on a
     * pre-check, give the database the chance to replay the original order by its idempotency
     * key. For a genuinely new order it rejects the same way and the richer pre-check message wins.
     */
    const rejectOrReplay = async (rejection: ActionError): Promise<PlaceOrderSuccessData> => {
      try {
        return succeed(await repos.orders.place(businessId, placeInput));
      } catch {
        throw rejection;
      }
    };

    // 6. Business & Settings Verification (read above, public columns only: anonymous visitors)
    if (!business) throw new ActionError("VALIDATION", "Business was not found.");

    if (settings) {
      if (settings.acceptingOrders === false) {
        return rejectOrReplay(
          reject("CONFLICT", "STORE_CLOSED", "This store is currently not accepting orders."),
        );
      }
      // Closed shop = scheduled orders only; a scheduled slot must be on an open day/time within
      // [today, today + 30] (place_order enforces the same rules).
      const slot = validateSlot(
        { weekly: settings.weeklyHours ?? null, exceptions: settings.hoursExceptions ?? [] },
        settings.timezone ?? DEFAULT_TIMEZONE,
        new Date(),
        { date: placeInput.requestedDate, time: placeInput.requestedTime, isAsap: data.isAsap },
      );
      if (!slot.ok) {
        return rejectOrReplay(
          reject("CONFLICT", SLOT_ERROR_REASONS[slot.reason], SLOT_ERROR_MESSAGES[slot.reason]),
        );
      }
      if (settings.serviceTypes && settings.serviceTypes[data.serviceType] === false) {
        return rejectOrReplay(
          reject(
            "CONFLICT",
            "SERVICE_TYPE_DISABLED",
            `${data.serviceType === "delivery" ? "Delivery" : "Pickup"} is currently disabled for this store.`,
          ),
        );
      }
    }

    // 7. Products, Pricing & Stock Verification
    const productMap = new Map<string, Product>(
      (await repos.products.list(businessId)).map((p) => [p.id, p]),
    );

    const lineErrors: Record<string, string> = {};
    const stockItemsToValidate: Array<{ product: Product; quantity: number }> = [];
    const pricingLineItems: PricingLineItem[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product || !product.visible) {
        lineErrors[item.productId] = "This product is unavailable.";
        continue;
      }
      stockItemsToValidate.push({ product, quantity: item.quantity });
      pricingLineItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price, // Authoritative DB price
      });
    }

    if (Object.keys(lineErrors).length > 0) {
      return rejectOrReplay(
        reject("CONFLICT", "STOCK_ERROR", "Some items in your order are currently unavailable.", {
          lineErrors,
        }),
      );
    }

    const stockCheck = validateOrderStock(stockItemsToValidate);
    if (!stockCheck.ok) {
      for (const err of stockCheck.errors) {
        lineErrors[err.productId] = err.message;
      }
      return rejectOrReplay(
        reject(
          "CONFLICT",
          "STOCK_ERROR",
          "Some items in your order are out of stock or have insufficient quantity.",
          { lineErrors },
        ),
      );
    }

    // Calculate totals & enforce minimum order amount on subtotal
    const totalsResult = calculateOrderTotals({
      items: pricingLineItems,
      serviceType: data.serviceType,
      deliveryFee: settings?.deliveryFee ?? 0,
      minimumOrderAmount: settings?.minOrderAmount ?? 0,
    });
    if (!totalsResult.ok) {
      return rejectOrReplay(reject("CONFLICT", "MINIMUM_ORDER_UNMET", totalsResult.message));
    }

    // 8. Atomic Order Placement via Repository. Its OrderRepoErrors carry generic, client-safe
    // messages and map to action codes in `defineAction`.
    return succeed(await repos.orders.place(businessId, placeInput));
  },
);
