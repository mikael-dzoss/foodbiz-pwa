import "server-only";

import { cache } from "react";
import { requireAuthenticatedAction } from "@/features/auth";
import { getRepositories } from "@/lib/repositories";
import { DEFAULT_TIMEZONE, getZonedDay, type Business, type BusinessSettings } from "@/domain";
import { getRequestNow } from "@/lib/request-time";

/** The signed-in manager's business profile. Read errors throw to the route error boundary. */
export async function getBusinessProfile(): Promise<Business> {
  const { businessId } = await requireAuthenticatedAction();
  const business = await getRepositories().business.findById(businessId);
  if (!business) throw new Error("Business not found");
  return business;
}

/** Settings used until the business saves its first settings row. */
function defaultSettings(businessId: string): BusinessSettings {
  return {
    businessId,
    currency: "EUR",
    dateFormat: "DD/MM/YYYY",
    lowStockThreshold: 5,
    taxPercentage: 0,
    notifications: true,
    acceptingOrders: true,
    serviceTypes: { pickup: true, delivery: true, dineIn: true },
    openingHours: "",
    weeklyHours: null,
    orderTimingAsap: true,
    orderTimingScheduled: true,
    orderTimingTimeOptional: true,
    deliveryFee: 0,
    minOrderAmount: 0,
    leadTimeValue: 1,
    leadTimeUnit: "business_days",
    revolutRevtag: "",
    weroIdentifier: "",
    paymentMethods: { cash: true, card: false, revolut: true, wero: true },
    paymentInstructionsEn: "",
    paymentInstructionsFr: "",
    inAppAlerts: true,
    soundAlerts: true,
    timezone: DEFAULT_TIMEZONE,
  };
}

/** Business settings, or the defaults when none are stored yet. Read errors throw. */
export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { businessId } = await requireAuthenticatedAction();
  return (await getRepositories().business.getSettings(businessId)) ?? defaultSettings(businessId);
}

/** The signed-in manager's business time zone (IANA name), deduplicated per request. */
export const getBusinessTimeZone = cache(async (): Promise<string> => {
  return (await getBusinessSettings()).timezone;
});

/** Today's calendar day (YYYY-MM-DD) on the business calendar, read at request time. */
export async function getBusinessToday(): Promise<string> {
  const [now, timeZone] = await Promise.all([getRequestNow(), getBusinessTimeZone()]);
  return getZonedDay(now, timeZone);
}
