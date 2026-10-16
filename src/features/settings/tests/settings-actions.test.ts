import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Business, BusinessSettings } from "@/domain";
import {
  getBusinessProfileAction,
  getBusinessSettingsAction,
  updateBusinessProfileAction,
  updateOrderingSettingsAction,
  updatePaymentSettingsAction,
  updateInventoryFinanceSettingsAction,
  updateNotificationSettingsAction,
  switchLanguageAction,
} from "../actions";

const mockRevalidatePath = vi.fn();
const mockRevalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
  revalidateTag: (tag: string, profile?: string) => mockRevalidateTag(tag, profile),
}));

const mockSetCookie = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mockSetCookie,
  })),
}));

const testBusinessId = "11111111-1111-4111-8111-111111111111";
const otherBusinessId = "99999999-9999-4999-8999-999999999999";

let mockBusiness: Business = {
  id: testBusinessId,
  name: "La Petite Boulangerie",
  slug: "la-petite-boulangerie",
  currency: "EUR",
  description: "Artisanal bakery",
  phone: "+33 1 43 55 67 89",
  email: "bonjour@lapetiteboulangerie.fr",
  whatsappNumber: "+33 6 12 34 56 78",
  address: "12 Rue de la Roquette, Paris",
  logoUrl: null,
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-01T08:00:00.000Z",
};

let mockSettings: BusinessSettings = {
  id: "11111111-1111-4111-8111-111111111112",
  businessId: testBusinessId,
  currency: "EUR",
  dateFormat: "DD/MM/YYYY",
  lowStockThreshold: 5,
  taxPercentage: 5.5,
  notifications: true,
  acceptingOrders: true,
  serviceTypes: {
    pickup: true,
    delivery: true,
    dineIn: true,
  },
  openingHours: "08:00 - 19:00",
  orderTimingAsap: true,
  orderTimingScheduled: true,
  orderTimingTimeOptional: true,
  deliveryFee: 350,
  minOrderAmount: 1500,
  revolutRevtag: "@boulangerie",
  weroIdentifier: "+33612345678",
  paymentMethods: {
    cash: true,
    revolut: true,
    wero: true,
  },
  paymentInstructionsEn: "Pay on pickup",
  paymentInstructionsFr: "Paiement au retrait",
  inAppAlerts: true,
  soundAlerts: true,
};

const mockBusinessRepo = {
  findById: vi.fn(async (id: string) =>
    id === testBusinessId ? structuredClone(mockBusiness) : null,
  ),
  findBySlug: vi.fn(async (slug: string) => {
    if (slug === mockBusiness.slug) return structuredClone(mockBusiness);
    if (slug === "taken-slug") {
      return {
        ...mockBusiness,
        id: otherBusinessId,
        slug: "taken-slug",
      };
    }
    return null;
  }),
  update: vi.fn(async (id: string, input: Partial<Business>) => {
    if (id !== testBusinessId) throw new Error("Business not found");
    mockBusiness = { ...mockBusiness, ...input, updatedAt: new Date().toISOString() };
    return structuredClone(mockBusiness);
  }),
  getSettings: vi.fn(async (bId: string) =>
    bId === testBusinessId ? structuredClone(mockSettings) : null,
  ),
  updateSettings: vi.fn(async (bId: string, input: Partial<BusinessSettings>) => {
    if (bId !== testBusinessId) throw new Error("Settings not found");
    mockSettings = { ...mockSettings, ...input };
    return structuredClone(mockSettings);
  }),
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: () => ({
    business: mockBusinessRepo,
  }),
}));

vi.mock("@/features/auth", () => ({
  requireAuthenticatedAction: vi.fn(async () => ({
    session: {
      user: {
        id: "00000000-0000-4000-8000-000000000002",
        email: "manager@test.com",
        name: "Marie Dupont",
        role: "manager",
        businessId: testBusinessId,
      },
      business: {
        id: testBusinessId,
        name: "La Petite Boulangerie",
        slug: "la-petite-boulangerie",
        currency: "EUR",
      },
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
    businessId: testBusinessId,
  })),
}));

describe("Settings Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBusinessProfileAction", () => {
    it("returns business profile on success", async () => {
      const res = await getBusinessProfileAction();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe(testBusinessId);
        expect(res.data.name).toBe("La Petite Boulangerie");
      }
    });

    it("returns error when business is not found", async () => {
      mockBusinessRepo.findById.mockResolvedValueOnce(null);
      const res = await getBusinessProfileAction();
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Business not found");
      }
    });

    it("handles repository Error exceptions in getBusinessProfileAction", async () => {
      mockBusinessRepo.findById.mockRejectedValueOnce(new Error("Database fetch error"));
      const res = await getBusinessProfileAction();
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Database fetch error");
      }
    });

    it("handles non-Error exceptions in getBusinessProfileAction", async () => {
      mockBusinessRepo.findById.mockRejectedValueOnce("Unknown fetch error");
      const res = await getBusinessProfileAction();
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Failed to load business profile");
      }
    });
  });

  describe("getBusinessSettingsAction", () => {
    it("returns business settings on success", async () => {
      const res = await getBusinessSettingsAction();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data?.businessId).toBe(testBusinessId);
        expect(res.data?.currency).toBe("EUR");
      }
    });

    it("handles repository Error exceptions in getBusinessSettingsAction", async () => {
      mockBusinessRepo.getSettings.mockRejectedValueOnce(new Error("Settings fetch error"));
      const res = await getBusinessSettingsAction();
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Settings fetch error");
      }
    });

    it("handles non-Error exceptions in getBusinessSettingsAction", async () => {
      mockBusinessRepo.getSettings.mockRejectedValueOnce("Unknown settings error");
      const res = await getBusinessSettingsAction();
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Failed to load business settings");
      }
    });
  });

  describe("updateBusinessProfileAction", () => {
    it("successfully updates business profile and revalidates paths", async () => {
      const updateData = {
        name: "La Grande Boulangerie",
        slug: "la-grande-boulangerie",
        description: "New updated description",
        phone: "+33 1 99 88 77 66",
        email: "contact@lagrande.fr",
        whatsappNumber: "+33 6 99 88 77 66",
        address: "10 Rue Oberkampf, 75011 Paris",
        logoUrl: "https://example.com/new-logo.png",
      };

      const res = await updateBusinessProfileAction(updateData);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("La Grande Boulangerie");
        expect(res.data.slug).toBe("la-grande-boulangerie");
        expect(res.data.description).toBe("New updated description");
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings/business");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage");
    });

    it("rejects invalid inputs", async () => {
      const res = await updateBusinessProfileAction({
        name: "", // name is required
        slug: "INVALID SLUG!",
        email: "bad-email",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.fieldErrors).toBeDefined();
        expect(res.fieldErrors?.name).toBeDefined();
        expect(res.fieldErrors?.slug).toBeDefined();
        expect(res.fieldErrors?.email).toBeDefined();
      }
    });

    it("rejects duplicate slug taken by another business", async () => {
      const res = await updateBusinessProfileAction({
        name: "My Shop",
        slug: "taken-slug",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("already taken");
        expect(res.fieldErrors?.slug).toBeDefined();
      }
    });

    it("handles repository Error exceptions in updateBusinessProfile", async () => {
      mockBusinessRepo.update.mockRejectedValueOnce(new Error("Profile update failed"));
      const res = await updateBusinessProfileAction({
        name: "Test Name",
        slug: "test-name",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Profile update failed");
      }
    });

    it("handles non-Error exceptions in updateBusinessProfile", async () => {
      mockBusinessRepo.update.mockRejectedValueOnce("Unknown profile failure");
      const res = await updateBusinessProfileAction({
        name: "Test Name",
        slug: "test-name",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Failed to update business profile");
      }
    });
  });

  describe("switchLanguageAction", () => {
    it("sets cookie for supported locale", async () => {
      const res = await switchLanguageAction("fr");
      expect(res.success).toBe(true);
      expect(mockSetCookie).toHaveBeenCalledWith(
        "foodbiz_locale",
        "fr",
        expect.objectContaining({ path: "/" }),
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage");
    });

    it("rejects unsupported locale", async () => {
      const res = await switchLanguageAction("de");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("Unsupported locale");
      }
    });

    it("handles exception in switchLanguageAction", async () => {
      mockSetCookie.mockImplementationOnce(() => {
        throw new Error("Cookie failed");
      });
      const res = await switchLanguageAction("fr");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Cookie failed");
      }
    });

    it("handles non-Error exception in switchLanguageAction", async () => {
      mockSetCookie.mockImplementationOnce(() => {
        throw "Cookie error string";
      });
      const res = await switchLanguageAction("fr");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Failed to update language");
      }
    });
  });

  describe("updateOrderingSettingsAction", () => {
    it("updates ordering preferences successfully and revalidates paths", async () => {
      const res = await updateOrderingSettingsAction({
        acceptingOrders: false,
        serviceTypes: {
          pickup: true,
          delivery: false,
          dineIn: true,
        },
        openingHours: "Mon-Fri: 09:00 - 18:00",
        orderTimingAsap: true,
        orderTimingScheduled: true,
        orderTimingTimeOptional: false,
        deliveryFee: 500,
        minOrderAmount: 2000,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.acceptingOrders).toBe(false);
        expect(res.data.serviceTypes?.delivery).toBe(false);
        expect(res.data.deliveryFee).toBe(500);
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings/ordering");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage");
    });

    it("rejects invalid ordering inputs when all fulfillment modes are disabled", async () => {
      const res = await updateOrderingSettingsAction({
        acceptingOrders: true,
        serviceTypes: {
          pickup: false,
          delivery: false,
          dineIn: false,
        },
        deliveryFee: -100,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.fieldErrors).toBeDefined();
        expect(res.fieldErrors?.serviceTypes).toBeDefined();
      }
    });
  });

  describe("updatePaymentSettingsAction", () => {
    it("updates payment settings and revalidates paths", async () => {
      const res = await updatePaymentSettingsAction({
        revolutRevtag: "@parisboulangerie",
        weroIdentifier: "+33698765432",
        paymentMethods: {
          cash: true,
          revolut: true,
          wero: false,
        },
        paymentInstructionsEn: "English instructions",
        paymentInstructionsFr: "Instructions francaises",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.revolutRevtag).toBe("@parisboulangerie");
        expect(res.data.paymentMethods?.wero).toBe(false);
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings/payment");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage");
    });

    it("rejects when all payment methods are disabled", async () => {
      const res = await updatePaymentSettingsAction({
        revolutRevtag: "@rev",
        paymentMethods: {
          cash: false,
          revolut: false,
          wero: false,
        },
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.fieldErrors?.paymentMethods).toBeDefined();
      }
    });
  });

  describe("updateInventoryFinanceSettingsAction", () => {
    it("updates inventory threshold and tax successfully", async () => {
      const res = await updateInventoryFinanceSettingsAction({
        lowStockThreshold: 10,
        taxPercentage: 20,
        currency: "EUR",
        dateFormat: "YYYY-MM-DD",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.lowStockThreshold).toBe(10);
        expect(res.data.taxPercentage).toBe(20);
        expect(res.data.dateFormat).toBe("YYYY-MM-DD");
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings/inventory-finance");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings");
    });

    it("rejects invalid negative thresholds or invalid tax", async () => {
      const res = await updateInventoryFinanceSettingsAction({
        lowStockThreshold: -5,
        taxPercentage: 150,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.fieldErrors?.lowStockThreshold).toBeDefined();
        expect(res.fieldErrors?.taxPercentage).toBeDefined();
      }
    });
  });

  describe("updateNotificationSettingsAction", () => {
    it("updates notification toggles successfully", async () => {
      const res = await updateNotificationSettingsAction({
        notifications: false,
        inAppAlerts: false,
        soundAlerts: false,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.notifications).toBe(false);
        expect(res.data.soundAlerts).toBe(false);
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings/notifications");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings");
    });

    it("rejects invalid notification input", async () => {
      const res = await updateNotificationSettingsAction({
        notifications: "invalid",
        inAppAlerts: 123,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.fieldErrors).toBeDefined();
      }
    });

    it("handles repository Error exceptions", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce(new Error("Alert save failed"));
      const res = await updateNotificationSettingsAction({
        notifications: true,
        inAppAlerts: true,
        soundAlerts: true,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Alert save failed");
      }
    });

    it("handles non-Error exceptions", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce("Unknown error");
      const res = await updateNotificationSettingsAction({
        notifications: true,
        inAppAlerts: true,
        soundAlerts: true,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Failed to update notification settings");
      }
    });
  });

  describe("actions error branches (catch blocks)", () => {
    it("handles repository Error exceptions in ordering settings", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce(new Error("Ordering write failed"));
      const res = await updateOrderingSettingsAction({
        acceptingOrders: true,
        serviceTypes: { pickup: true, delivery: true, dineIn: true },
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Ordering write failed");
      }
    });

    it("handles non-Error exceptions in ordering settings", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce("Ordering failure");
      const res = await updateOrderingSettingsAction({
        acceptingOrders: true,
        serviceTypes: { pickup: true, delivery: true, dineIn: true },
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Failed to update ordering settings");
      }
    });

    it("handles repository Error exceptions in payment settings", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce(new Error("Payment write failed"));
      const res = await updatePaymentSettingsAction({
        paymentMethods: { cash: true, revolut: true, wero: true },
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Payment write failed");
      }
    });

    it("handles non-Error exceptions in payment settings", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce("Payment failure");
      const res = await updatePaymentSettingsAction({
        paymentMethods: { cash: true, revolut: true, wero: true },
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Failed to update payment settings");
      }
    });

    it("handles repository Error exceptions in inventory & finance settings", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce(new Error("Inventory save error"));
      const res = await updateInventoryFinanceSettingsAction({
        lowStockThreshold: 10,
        taxPercentage: 20,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Inventory save error");
      }
    });

    it("handles non-Error exceptions in inventory & finance settings", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce("Inventory failure");
      const res = await updateInventoryFinanceSettingsAction({
        lowStockThreshold: 10,
        taxPercentage: 20,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Failed to update inventory and finance settings");
      }
    });
  });
});
