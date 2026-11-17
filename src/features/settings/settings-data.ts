import "server-only";

import { requireAuthenticatedAction } from "@/features/auth";
import { getRepositories } from "@/lib/repositories";
import type { Business, BusinessSettings } from "@/domain";

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
    orderTimingAsap: true,
    orderTimingScheduled: true,
    orderTimingTimeOptional: true,
    deliveryFee: 0,
    minOrderAmount: 0,
    leadTimeValue: 1,
    leadTimeUnit: "business_days",
    revolutRevtag: "",
    weroIdentifier: "",
    paymentMethods: { cash: true, revolut: true, wero: true },
    paymentInstructionsEn: "",
    paymentInstructionsFr: "",
    inAppAlerts: true,
    soundAlerts: true,
  };
}

/** Business settings, or the defaults when none are stored yet. Read errors throw. */
export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { businessId } = await requireAuthenticatedAction();
  return (await getRepositories().business.getSettings(businessId)) ?? defaultSettings(businessId);
}
