"use server";

import { headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { getStorefrontBusinessId, getStorefrontRepositories } from "@/lib/repositories/storefront";
import {
  mergeDuplicateItems,
  placeOrderInputSchema,
  type PlaceOrderResult,
  type PlaceOrderSuccessData,
} from "@/domain/checkout";
import {
  validateHoneypot,
  validateOrderQuantities,
  RATE_LIMIT_IP_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "@/domain/anti-abuse";
import {
  normalizePhoneNumber,
  OrderRepoError,
  type PlacedOrderSummary,
  type Product,
} from "@/domain";
import { validateOrderStock } from "@/domain/stock";
import { calculateOrderTotals, type PricingLineItem } from "@/domain/pricing";
import { logAntiAbuseRejection } from "@/lib/anti-abuse-log";
import { getGlobalRateLimiter } from "@/lib/rate-limiter";

/** Logs the real failure server-side (no request data) and returns a generic typed error. */
function internalError(step: string, err: unknown): PlaceOrderResult {
  console.error(`placeOrderAction: ${step} failed`, err instanceof Error ? err.message : err);
  return {
    success: false,
    error: "We could not place your order. Please try again.",
    code: "INTERNAL_ERROR",
  };
}

/**
 * Public customer storefront action for placing an order (Issues #87, #90).
 * Hardened with honeypot verification, a per-IP rate limit (cheap first layer; the database
 * cannot trust client IP headers), max line/order caps, authoritative server-side price
 * recalculation, atomic stock reservation with rollback and blind guest linkage (zero PII
 * leakage). The per-phone and per-business rate limits, the quantity caps and idempotent replay
 * (`idempotencyKey`) are enforced by the database inside `place_order`, so they also hold across
 * server instances and for callers that bypass this action.
 */
export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  const reqHeaders = await headers();
  const rawForwarded = reqHeaders.get("x-forwarded-for");
  // No shared fallback bucket: unknown IPs must not be able to lock each other out.
  const clientIp = (rawForwarded?.split(",")[0] ?? reqHeaders.get("x-real-ip"))?.trim() || null;

  // 1. Zod input parsing & preliminary validation
  const parsed = placeOrderInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      fieldErrors[path] = fieldErrors[path] || [];
      fieldErrors[path].push(issue.message);
    }
    return {
      success: false,
      error: "Order validation failed: please check your details.",
      code: "VALIDATION_ERROR",
      fieldErrors,
    };
  }

  const data = parsed.data;
  const businessId = getStorefrontBusinessId();
  // One line per product so stock checks, reservations and caps cannot be bypassed by repeating a line.
  const items = mergeDuplicateItems(data.items);

  // 2. Anti-Abuse: Honeypot check
  const honeypotCheck = validateHoneypot(data.honeypot);
  if (!honeypotCheck.ok) {
    logAntiAbuseRejection({
      reason: "honeypot",
      ip: clientIp,
      phone: data.phone,
    });
    return {
      success: false,
      error: "Order submission rejected by security filter.",
      code: "ANTI_ABUSE_REJECTION",
    };
  }

  // 3. Anti-Abuse: Quantity caps per line (<= 50) and per order (<= 100)
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
    const lineErrors: Record<string, string> = {};
    if (quantityCheck.productId) {
      lineErrors[quantityCheck.productId] = quantityCheck.message;
    }
    return {
      success: false,
      error: quantityCheck.message,
      code: "ANTI_ABUSE_REJECTION",
      lineErrors: Object.keys(lineErrors).length > 0 ? lineErrors : undefined,
    };
  }

  // 4. Normalize phone number for rate limiting and guest matching
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizePhoneNumber(data.phone);
  } catch {
    return {
      success: false,
      error: "Invalid phone number format.",
      code: "VALIDATION_ERROR",
      fieldErrors: { phone: ["Invalid phone number format"] },
    };
  }

  // 5. Anti-Abuse: per-IP rate limiting (per-phone and per-business limits live in the database)
  const rateLimiter = getGlobalRateLimiter();
  const ipCheck = clientIp
    ? rateLimiter.check(`ip:${clientIp}`, RATE_LIMIT_IP_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)
    : null;
  if (ipCheck && !ipCheck.allowed) {
    logAntiAbuseRejection({
      reason: "rate_limit_ip",
      ip: clientIp,
      phone: normalizedPhone,
    });
    return {
      success: false,
      error: "Too many order attempts. Please wait a few minutes before trying again.",
      code: "ANTI_ABUSE_REJECTION",
    };
  }

  const repos = getStorefrontRepositories();

  // 6. Order request for the repository (also used to replay a retry, see rejectOrReplay)
  const now = new Date().toISOString();
  const todayDate = now.slice(0, 10);
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
    // The database returns the original order for a repeated key (no second order, no second
    // stock decrement), also across server instances.
    idempotencyKey: data.idempotencyKey,
  };

  const succeed = (summary: PlacedOrderSummary): PlaceOrderResult => {
    if (summary.replayed) {
      // A retry of an order that already exists: nothing was created, so it does not count
      // against the per-IP budget and there is nothing to revalidate.
      if (clientIp) rateLimiter.release(`ip:${clientIp}`);
    } else {
      // Revalidate public catalog and manager orders cache
      try {
        revalidateTag("storefront-catalog", "max");
        revalidateTag(`storefront-catalog-${businessId}`, "max");
        revalidatePath("/manage/orders");
        revalidatePath("/manage/products");
      } catch {
        // Revalidation may be skipped in test environments
      }
    }

    const successData: PlaceOrderSuccessData = {
      orderId: summary.orderId,
      orderNumber: summary.orderNumber,
      trackingToken: summary.trackingToken,
      status: "NEW",
      totalAmount: summary.totalAmount,
    };
    return { success: true, data: successData };
  };

  /**
   * The pre-checks below read current stock and settings, so a retry of an order that already
   * succeeded (and took the last unit) would be reported as a failure. Before returning a
   * pre-check rejection, give the database the chance to replay the original order by its
   * idempotency key. For a genuinely new order it rejects the same way and the richer
   * pre-check message wins.
   */
  const rejectOrReplay = async (rejection: PlaceOrderResult): Promise<PlaceOrderResult> => {
    try {
      return succeed(await repos.orders.place(businessId, placeInput));
    } catch {
      return rejection;
    }
  };

  // 7. Business & Settings Verification (public columns only: this action runs for anonymous visitors)
  let business: Awaited<ReturnType<typeof repos.business.findById>>;
  let settings: Awaited<ReturnType<typeof repos.business.getSettings>>;
  try {
    [business, settings] = await Promise.all([
      repos.business.findById(businessId),
      repos.business.getSettings(businessId),
    ]);
  } catch (err) {
    return internalError("business lookup", err);
  }

  if (!business) {
    return {
      success: false,
      error: "Business was not found.",
      code: "VALIDATION_ERROR",
    };
  }

  if (settings) {
    if (settings.acceptingOrders === false) {
      return rejectOrReplay({
        success: false,
        error: "This store is currently not accepting orders.",
        code: "STORE_CLOSED",
      });
    }

    if (settings.serviceTypes && settings.serviceTypes[data.serviceType] === false) {
      return rejectOrReplay({
        success: false,
        error: `${data.serviceType === "delivery" ? "Delivery" : "Pickup"} is currently disabled for this store.`,
        code: "SERVICE_TYPE_DISABLED",
      });
    }
  }

  // 8. Products, Pricing & Stock Verification
  let allProducts: Product[];
  try {
    allProducts = await repos.products.list(businessId);
  } catch (err) {
    return internalError("product lookup", err);
  }
  const productMap = new Map<string, Product>();
  for (const p of allProducts) {
    productMap.set(p.id, p);
  }

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
    return rejectOrReplay({
      success: false,
      error: "Some items in your order are currently unavailable.",
      code: "STOCK_ERROR",
      lineErrors,
    });
  }

  // Validate stock across all lines
  const stockCheck = validateOrderStock(stockItemsToValidate);
  if (!stockCheck.ok) {
    for (const err of stockCheck.errors) {
      lineErrors[err.productId] = err.message;
    }
    return rejectOrReplay({
      success: false,
      error: "Some items in your order are out of stock or have insufficient quantity.",
      code: "STOCK_ERROR",
      lineErrors,
    });
  }

  // Calculate totals & enforce minimum order amount on subtotal
  const totalsResult = calculateOrderTotals({
    items: pricingLineItems,
    serviceType: data.serviceType,
    deliveryFee: settings?.deliveryFee ?? 0,
    minimumOrderAmount: settings?.minOrderAmount ?? 0,
  });

  if (!totalsResult.ok) {
    return rejectOrReplay({
      success: false,
      error: totalsResult.message,
      code: "MINIMUM_ORDER_UNMET",
    });
  }

  // 9. Atomic Order Placement via Repository
  try {
    return succeed(await repos.orders.place(businessId, placeInput));
  } catch (err) {
    if (err instanceof OrderRepoError) {
      // Repository messages are already generic and client-safe (see mapPlaceOrderError).
      const allowedCodes = [
        "VALIDATION_ERROR",
        "ANTI_ABUSE_REJECTION",
        "STORE_CLOSED",
        "SERVICE_TYPE_DISABLED",
        "MINIMUM_ORDER_UNMET",
        "STOCK_ERROR",
      ] as const;
      const code = allowedCodes.includes(err.code as (typeof allowedCodes)[number])
        ? (err.code as (typeof allowedCodes)[number])
        : err.code === "INVALID_INPUT"
          ? "VALIDATION_ERROR"
          : "INTERNAL_ERROR";
      return {
        success: false,
        error: err.message,
        code,
        lineErrors: err.lineErrors,
      };
    }
    return internalError("order placement", err);
  }
}
