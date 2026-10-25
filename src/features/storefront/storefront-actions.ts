"use server";

import { headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { getRepositories } from "@/lib/repositories";
import { DEMO_BUSINESS_ID } from "@/lib/repositories/mock/fixtures/business";
import {
  placeOrderInputSchema,
  type PlaceOrderResult,
  type PlaceOrderSuccessData,
} from "@/domain/checkout";
import {
  validateHoneypot,
  validateOrderQuantities,
  logAntiAbuseRejection,
  RATE_LIMIT_IP_MAX_REQUESTS,
  RATE_LIMIT_PHONE_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "@/domain/anti-abuse";
import { normalizePhoneNumber, type Product, type OrderItem } from "@/domain";
import { validateOrderStock, reserveStock, restoreStock } from "@/domain/stock";
import { calculateOrderTotals, type PricingLineItem } from "@/domain/pricing";
import { getGlobalRateLimiter } from "@/lib/rate-limiter";
import { getGlobalIdempotencyStore } from "@/lib/idempotency";

/**
 * Public customer storefront action for placing an order (Issues #87, #90).
 * Hardened with honeypot verification, IP/phone rate limiting, max line/order caps,
 * authoritative server-side price recalculation, atomic stock reservation with rollback,
 * blind guest linkage (zero PII leakage), and idempotency replay protection.
 */
export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  const reqHeaders = await headers();
  const rawForwarded = reqHeaders.get("x-forwarded-for");
  const clientIp = rawForwarded
    ? rawForwarded.split(",")[0].trim()
    : reqHeaders.get("x-real-ip") || "unknown-ip";

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
  const businessId = data.businessId ?? DEMO_BUSINESS_ID;

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
  const quantityCheck = validateOrderQuantities(data.items);
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

  // 5. Anti-Abuse: Rate limiting per IP and per Phone
  const rateLimiter = getGlobalRateLimiter();
  const ipCheck = rateLimiter.check(
    `ip:${clientIp}`,
    RATE_LIMIT_IP_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!ipCheck.allowed) {
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

  const phoneCheck = rateLimiter.check(
    `phone:${normalizedPhone}`,
    RATE_LIMIT_PHONE_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!phoneCheck.allowed) {
    logAntiAbuseRejection({
      reason: "rate_limit_phone",
      ip: clientIp,
      phone: normalizedPhone,
    });
    return {
      success: false,
      error:
        "Too many order attempts for this phone number. Please wait a few minutes before trying again.",
      code: "ANTI_ABUSE_REJECTION",
    };
  }

  // 6. Idempotency Check & In-flight coordination
  const idempotencyStore = getGlobalIdempotencyStore();
  const cachedResult = idempotencyStore.get(businessId, data.idempotencyKey);
  if (cachedResult) {
    return { success: true, data: cachedResult };
  }

  const inFlightPromise = idempotencyStore.getInFlight(businessId, data.idempotencyKey);
  if (inFlightPromise) {
    return await inFlightPromise;
  }

  // Internal execution wrapped to register in-flight promise
  const executeOrder = async (): Promise<PlaceOrderResult> => {
    const repos = getRepositories();

    // 7. Business & Settings Verification
    const [business, settings] = await Promise.all([
      repos.business.findById(businessId),
      repos.business.getSettings(businessId),
    ]);

    if (!business) {
      return {
        success: false,
        error: "Business was not found.",
        code: "VALIDATION_ERROR",
      };
    }

    if (settings) {
      if (settings.acceptingOrders === false) {
        return {
          success: false,
          error: "This store is currently not accepting orders.",
          code: "STORE_CLOSED",
        };
      }

      if (settings.serviceTypes && settings.serviceTypes[data.serviceType] === false) {
        return {
          success: false,
          error: `${data.serviceType === "delivery" ? "Delivery" : "Pickup"} is currently disabled for this store.`,
          code: "SERVICE_TYPE_DISABLED",
        };
      }
    }

    // 8. Products, Pricing & Stock Verification
    const allProducts = await repos.products.list(businessId);
    const productMap = new Map<string, Product>();
    for (const p of allProducts) {
      productMap.set(p.id, p);
    }

    const lineErrors: Record<string, string> = {};
    const stockItemsToValidate: Array<{ product: Product; quantity: number }> = [];
    const pricingLineItems: PricingLineItem[] = [];

    for (const item of data.items) {
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
      return {
        success: false,
        error: "Some items in your order are currently unavailable.",
        code: "STOCK_ERROR",
        lineErrors,
      };
    }

    // Validate stock across all lines
    const stockCheck = validateOrderStock(stockItemsToValidate);
    if (!stockCheck.ok) {
      for (const err of stockCheck.errors) {
        lineErrors[err.productId] = err.message;
      }
      return {
        success: false,
        error: "Some items in your order are out of stock or have insufficient quantity.",
        code: "STOCK_ERROR",
        lineErrors,
      };
    }

    // Calculate totals & enforce minimum order amount on subtotal
    const totalsResult = calculateOrderTotals({
      items: pricingLineItems,
      serviceType: data.serviceType,
      deliveryFee: settings?.deliveryFee ?? 0,
      minimumOrderAmount: settings?.minOrderAmount ?? 0,
    });

    if (!totalsResult.ok) {
      return {
        success: false,
        error: totalsResult.message,
        code: "MINIMUM_ORDER_UNMET",
      };
    }

    // 9. Atomic Stock Reservation with Automatic Rollback
    const successfullyDecremented: Array<{ product: Product; reservedQuantity: number }> = [];

    for (const item of data.items) {
      const product = productMap.get(item.productId)!;
      const reservation = reserveStock(product, item.quantity);

      if (!reservation.ok) {
        // Rollback any previously decremented products in this transaction
        for (const rollback of successfullyDecremented) {
          const restored = restoreStock(rollback.product, rollback.reservedQuantity);
          if (restored.ok) {
            await repos.products.update(businessId, rollback.product.id, {
              stock: restored.updatedStock,
            });
          }
        }
        return {
          success: false,
          error: reservation.error.message,
          code: "STOCK_ERROR",
          lineErrors: { [product.id]: reservation.error.message },
        };
      }

      // Persist stock decrement
      await repos.products.update(businessId, product.id, {
        stock: reservation.remainingStock,
      });
      successfullyDecremented.push({ product, reservedQuantity: item.quantity });
    }

    // 10. Blind Guest Find-or-Create (allowRename: false)
    // Links guestId without reading back or overwriting stored name; audits differing submitted name.
    const guestResult = await repos.guests.findOrCreate(businessId, {
      name: data.name,
      phone: normalizedPhone,
      address: data.deliveryAddress ?? null,
      allowRename: false,
    });

    // 11. Create Order
    const now = new Date().toISOString();
    const todayDate = now.slice(0, 10);
    const requestedDate = data.isAsap ? todayDate : (data.requestedDate ?? todayDate);
    const requestedTime = data.isAsap ? null : (data.requestedTime ?? null);

    const orderItems: OrderItem[] = totalsResult.items.map((it) => ({
      id: crypto.randomUUID(),
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
    }));

    const order = await repos.orders.create(businessId, {
      guestId: guestResult.guestId,
      submittedName: guestResult.nameMismatch ? data.name : null,
      serviceType: data.serviceType,
      channel: "storefront",
      status: "NEW",
      paid: "unpaid",
      paymentPreference: data.paymentPreference,
      requestedDate,
      requestedTime,
      items: orderItems,
      totalAmount: totalsResult.total,
      notes: data.notes ?? null,
      deliveryAddress: data.deliveryAddress ?? null,
      statusHistory: [
        {
          status: "NEW",
          timestamp: now,
          note: "Order placed via online storefront",
        },
      ],
    });

    const successData: PlaceOrderSuccessData = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
      status: order.status,
      totalAmount: order.totalAmount,
    };

    // Cache successful order result in idempotency store
    idempotencyStore.set(businessId, data.idempotencyKey, successData);

    // Revalidate public catalog and manager orders cache
    try {
      revalidateTag("storefront-catalog", "max");
      revalidateTag(`storefront-catalog-${businessId}`, "max");
      revalidatePath("/manage/orders");
      revalidatePath("/manage/products");
    } catch {
      // Revalidation may be skipped in test environments
    }

    return {
      success: true,
      data: successData,
    };
  };

  const promise = executeOrder();
  idempotencyStore.setInFlight(businessId, data.idempotencyKey, promise);

  try {
    const result = await promise;
    return result;
  } finally {
    idempotencyStore.removeInFlight(businessId, data.idempotencyKey);
  }
}
