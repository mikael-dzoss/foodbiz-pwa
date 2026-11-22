"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { redirect } from "next/navigation";
import { defineAction } from "@/lib/actions/define-action";
import { ActionError } from "@/lib/actions/types";
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

const lookupSchema = orderLookupInputSchema.extend({ locale: z.string().optional() });

/** Unknown orders, phone mismatches and bots share one generic NOT_FOUND; no order data is echoed. */
const lookupOrder = defineAction(
  "lookupOrder",
  { auth: "public", input: lookupSchema },
  async ({ input }) => {
    // Bots filling the hidden field get the same answer as a miss.
    if (!validateHoneypot(input.website).ok) throw new ActionError("NOT_FOUND");

    let phone: string;
    try {
      phone = normalizePhoneNumber(input.phone);
    } catch {
      throw new ActionError("VALIDATION");
    }

    const reqHeaders = await headers();
    const forwarded = reqHeaders.get("x-forwarded-for");
    const clientIp = (forwarded?.split(",")[0] ?? reqHeaders.get("x-real-ip"))?.trim() || null;

    if (
      clientIp &&
      !getGlobalRateLimiter().check(
        `lookup-ip:${clientIp}`,
        LOOKUP_RATE_LIMIT_IP_MAX_REQUESTS,
        RATE_LIMIT_WINDOW_MS,
      ).allowed
    ) {
      logAntiAbuseRejection({ reason: "lookup_rate_limit_ip", ip: clientIp, phone });
      throw new ActionError("RATE_LIMITED");
    }

    // The per-phone limit (failed lookups) lives in the database so it also holds across server
    // instances and for direct RPC callers (it surfaces as an OrderRepoError RATE_LIMITED); the
    // per-IP limiter above is a cheap first layer.
    let trackingToken: string | null;
    try {
      trackingToken = await getStorefrontRepositories().orders.findTrackingTokenByTicketAndPhone(
        getStorefrontBusinessId(),
        input.orderNumber,
        phone,
      );
    } catch (err) {
      if (err instanceof OrderRepoError && err.code === "RATE_LIMITED") {
        logAntiAbuseRejection({ reason: "lookup_rate_limit_phone", ip: clientIp, phone });
      }
      throw err;
    }
    if (!trackingToken) throw new ActionError("NOT_FOUND");

    const locale = isSupportedLocale(input.locale ?? "") ? input.locale : DEFAULT_LOCALE;
    redirect(`/${locale}/order/${encodeURIComponent(trackingToken)}`);
  },
);

/**
 * Public order lookup (#230): phone + order number → tracking page. The form state keeps the
 * submitted values so React's post-action form reset does not clear what the customer typed.
 */
export async function lookupOrderAction(
  _prev: OrderLookupState,
  formData: FormData,
): Promise<OrderLookupState> {
  const values = {
    phone: String(formData.get("phone") ?? "").slice(0, 30),
    orderNumber: String(formData.get("orderNumber") ?? "").slice(0, 10),
  };
  const res = await lookupOrder({
    phone: formData.get("phone"),
    orderNumber: formData.get("orderNumber"),
    website: formData.get("website") ?? undefined,
    locale: String(formData.get("locale") ?? ""),
  });
  // Success redirects, so only failures get here.
  if (res.ok || res.code === "INTERNAL") throw new Error("Order lookup failed");
  const code =
    res.code === "VALIDATION"
      ? "INVALID"
      : res.code === "RATE_LIMITED"
        ? "RATE_LIMITED"
        : "NOT_FOUND";
  return { status: "error", code, values };
}
