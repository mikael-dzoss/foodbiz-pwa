"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStorefrontBusinessId, getStorefrontRepositories } from "@/lib/repositories/storefront";
import { getGlobalRateLimiter } from "@/lib/rate-limiter";
import { logAntiAbuseRejection } from "@/lib/anti-abuse-log";
import { normalizePhoneNumber } from "@/domain/guest";
import { OrderRepoError } from "@/domain/order";
import { isSupportedLocale, DEFAULT_LOCALE } from "@/domain/i18n";
import {
  LOOKUP_RATE_LIMIT_IP_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  validateHoneypot,
} from "@/domain/anti-abuse";
import { orderLookupInputSchema, type OrderLookupState } from "@/domain/order-lookup";

/**
 * Public order lookup (#230): phone + order number → tracking page.
 * Unknown orders and phone mismatches share one generic error; no order data is echoed.
 */
export async function lookupOrderAction(
  _prev: OrderLookupState,
  formData: FormData,
): Promise<OrderLookupState> {
  const values = {
    phone: String(formData.get("phone") ?? "").slice(0, 30),
    orderNumber: String(formData.get("orderNumber") ?? "").slice(0, 10),
  };
  const fail = (code: "INVALID" | "NOT_FOUND" | "RATE_LIMITED"): OrderLookupState => ({
    status: "error",
    code,
    values,
  });
  const rawLocale = String(formData.get("locale") ?? "");
  const locale = isSupportedLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const parsed = orderLookupInputSchema.safeParse({
    phone: formData.get("phone"),
    orderNumber: formData.get("orderNumber"),
    website: formData.get("website") ?? undefined,
  });
  if (!parsed.success) return fail("INVALID");

  // Bots filling the hidden field get the same answer as a miss.
  if (!validateHoneypot(parsed.data.website).ok) return fail("NOT_FOUND");

  let phone: string;
  try {
    phone = normalizePhoneNumber(parsed.data.phone);
  } catch {
    return fail("INVALID");
  }

  const reqHeaders = await headers();
  const forwarded = reqHeaders.get("x-forwarded-for");
  const clientIp = (forwarded?.split(",")[0] ?? reqHeaders.get("x-real-ip"))?.trim() || null;
  const limiter = getGlobalRateLimiter();

  if (
    clientIp &&
    !limiter.check(`lookup-ip:${clientIp}`, LOOKUP_RATE_LIMIT_IP_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)
      .allowed
  ) {
    logAntiAbuseRejection({ reason: "lookup_rate_limit_ip", ip: clientIp, phone });
    return fail("RATE_LIMITED");
  }
  // The per-phone limit (failed lookups) lives in the database so it also holds across server
  // instances and for direct RPC callers; the per-IP limiter above is a cheap first layer.
  let trackingToken: string | null;
  try {
    trackingToken = await getStorefrontRepositories().orders.findTrackingTokenByTicketAndPhone(
      getStorefrontBusinessId(),
      parsed.data.orderNumber,
      phone,
    );
  } catch (err) {
    if (err instanceof OrderRepoError && err.code === "RATE_LIMITED") {
      logAntiAbuseRejection({ reason: "lookup_rate_limit_phone", ip: clientIp, phone });
      return fail("RATE_LIMITED");
    }
    throw err;
  }
  if (!trackingToken) return fail("NOT_FOUND");

  redirect(`/${locale}/order/${encodeURIComponent(trackingToken)}`);
}
