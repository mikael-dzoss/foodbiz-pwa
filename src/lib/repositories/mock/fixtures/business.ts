import type { Business, BusinessMember, BusinessSettings } from "@/domain/business";

export const DEMO_BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_OWNER_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_MANAGER_USER_ID = "00000000-0000-4000-8000-000000000002";

export const demoBusiness: Business = {
  id: DEMO_BUSINESS_ID,
  name: "La Petite Boulangerie",
  slug: "la-petite-boulangerie",
  currency: "EUR",
  description: "Artisanal organic sourdough bakery and French pastries in Paris.",
  phone: "+33 1 43 55 67 89",
  email: "bonjour@lapetiteboulangerie.fr",
  whatsappNumber: "+33 6 12 34 56 78",
  instagramUrl: "https://instagram.com/lapetiteboulangerie",
  facebookUrl: "https://facebook.com/lapetiteboulangerie",
  address: "12 Rue de la Roquette, 75011 Paris, France",
  latitude: 48.8553,
  longitude: 2.3726,
  logoUrl: null,
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

  // Ordering (#71)
  acceptingOrders: true,
  serviceTypes: {
    pickup: true,
    delivery: true,
    dineIn: true,
  },
  openingHours: "Mon-Sat: 07:00 - 19:30, Sun: 08:00 - 13:00",
  orderTimingAsap: true,
  orderTimingScheduled: true,
  orderTimingTimeOptional: true,
  deliveryFee: 350, // €3.50 in cents
  minOrderAmount: 1500, // €15.00 in cents

  // Payment (#72)
  revolutRevtag: "@boulangerie",
  weroIdentifier: "+33612345678",
  paymentMethods: {
    cash: true,
    revolut: true,
    wero: true,
  },
  paymentInstructionsEn: "Please prepare exact change or present your QR code on handover.",
  paymentInstructionsFr:
    "Merci de préparer l'appoint ou de présenter votre code QR lors du retrait.",

  // Notifications & Sound (#74)
  inAppAlerts: true,
  soundAlerts: true,
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
