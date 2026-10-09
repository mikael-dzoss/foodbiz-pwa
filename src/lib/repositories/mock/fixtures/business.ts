import type { Business, BusinessMember, BusinessSettings } from "@/domain/business";

export const DEMO_BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_OWNER_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_MANAGER_USER_ID = "00000000-0000-4000-8000-000000000002";

export const demoBusiness: Business = {
  id: DEMO_BUSINESS_ID,
  name: "La Petite Boulangerie",
  slug: "la-petite-boulangerie",
  currency: "EUR",
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-01T08:00:00.000Z",
};

export const demoSettings: BusinessSettings = {
  id: "11111111-1111-4111-8111-111111111112",
  businessId: DEMO_BUSINESS_ID,
  currency: "EUR",
  dateFormat: "DD/MM/YYYY",
  lowStockThreshold: 5,
  taxPercentage: 5.5,
  notifications: true,
};

export const demoMembers: BusinessMember[] = [
  {
    id: "11111111-1111-4111-8111-111111111121",
    businessId: DEMO_BUSINESS_ID,
    userId: DEMO_OWNER_USER_ID,
    role: "owner",
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111122",
    businessId: DEMO_BUSINESS_ID,
    userId: DEMO_MANAGER_USER_ID,
    role: "manager",
    createdAt: "2026-08-01T08:00:00.000Z",
  },
];
