import type { Business, BusinessMember, BusinessSettings } from "@/domain/business";
import { DEMO_CATALOG_BUSINESS, DEMO_CATALOG_SETTINGS } from "./catalog.data";

export const DEMO_BUSINESS_ID = DEMO_CATALOG_BUSINESS.id;
export const DEMO_OWNER_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_MANAGER_USER_ID = "00000000-0000-4000-8000-000000000002";

const DEMO_CREATED_AT = "2026-08-01T08:00:00.000Z";

export const demoBusiness: Business = {
  id: DEMO_CATALOG_BUSINESS.id,
  name: DEMO_CATALOG_BUSINESS.name,
  slug: DEMO_CATALOG_BUSINESS.slug,
  currency: DEMO_CATALOG_BUSINESS.currency,
  description: DEMO_CATALOG_BUSINESS.description,
  phone: DEMO_CATALOG_BUSINESS.phone,
  email: DEMO_CATALOG_BUSINESS.email,
  whatsappNumber: DEMO_CATALOG_BUSINESS.whatsappNumber,
  instagramUrl: DEMO_CATALOG_BUSINESS.instagramUrl,
  facebookUrl: DEMO_CATALOG_BUSINESS.facebookUrl,
  tiktokUrl: DEMO_CATALOG_BUSINESS.tiktokUrl,
  address: DEMO_CATALOG_BUSINESS.address,
  latitude: DEMO_CATALOG_BUSINESS.latitude,
  longitude: DEMO_CATALOG_BUSINESS.longitude,
  logoUrl: DEMO_CATALOG_BUSINESS.logoUrl,
  createdAt: DEMO_CREATED_AT,
  updatedAt: DEMO_CREATED_AT,
};

export const demoSettings: BusinessSettings = {
  id: DEMO_CATALOG_SETTINGS.id,
  businessId: DEMO_BUSINESS_ID,
  currency: DEMO_CATALOG_SETTINGS.currency,
  dateFormat: DEMO_CATALOG_SETTINGS.dateFormat,
  lowStockThreshold: DEMO_CATALOG_SETTINGS.lowStockThreshold,
  taxPercentage: DEMO_CATALOG_SETTINGS.taxPercentage,
  notifications: DEMO_CATALOG_SETTINGS.notifications,

  // Ordering (#71)
  acceptingOrders: DEMO_CATALOG_SETTINGS.acceptingOrders,
  serviceTypes: { ...DEMO_CATALOG_SETTINGS.serviceTypes },
  openingHours: DEMO_CATALOG_SETTINGS.openingHours,
  weeklyHours: DEMO_CATALOG_SETTINGS.weeklyHours,
  orderTimingAsap: DEMO_CATALOG_SETTINGS.orderTimingAsap,
  orderTimingScheduled: DEMO_CATALOG_SETTINGS.orderTimingScheduled,
  orderTimingTimeOptional: DEMO_CATALOG_SETTINGS.orderTimingTimeOptional,
  deliveryFee: DEMO_CATALOG_SETTINGS.deliveryFee,
  minOrderAmount: DEMO_CATALOG_SETTINGS.minOrderAmount,
  leadTimeValue: DEMO_CATALOG_SETTINGS.leadTimeValue,
  leadTimeUnit: DEMO_CATALOG_SETTINGS.leadTimeUnit,
  timezone: DEMO_CATALOG_SETTINGS.timezone,

  // Payment (#72)
  revolutRevtag: DEMO_CATALOG_SETTINGS.revolutRevtag,
  weroIdentifier: DEMO_CATALOG_SETTINGS.weroIdentifier,
  paymentMethods: { ...DEMO_CATALOG_SETTINGS.paymentMethods },
  paymentInstructionsEn: DEMO_CATALOG_SETTINGS.paymentInstructionsEn,
  paymentInstructionsFr: DEMO_CATALOG_SETTINGS.paymentInstructionsFr,

  // Notifications & Sound (#74)
  inAppAlerts: DEMO_CATALOG_SETTINGS.inAppAlerts,
  soundAlerts: DEMO_CATALOG_SETTINGS.soundAlerts,
};

export const demoMembers: BusinessMember[] = [
  {
    id: "11111111-1111-4111-8111-111111111121",
    businessId: DEMO_BUSINESS_ID,
    userId: DEMO_OWNER_USER_ID,
    role: "owner",
    createdAt: DEMO_CREATED_AT,
  },
  {
    id: "11111111-1111-4111-8111-111111111122",
    businessId: DEMO_BUSINESS_ID,
    userId: DEMO_MANAGER_USER_ID,
    role: "manager",
    createdAt: DEMO_CREATED_AT,
  },
];
