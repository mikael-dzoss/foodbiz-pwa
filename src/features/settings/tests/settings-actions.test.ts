import { describe, expect, it, vi, beforeEach } from "vitest";
import { requireAuthenticatedAction } from "@/features/auth";
import type { Business, BusinessSettings } from "@/domain";
import { demoBusiness, demoSettings } from "@/lib/repositories/mock/fixtures";
import {
  updateBusinessProfileAction,
  updateOrderingSettingsAction,
  updatePaymentSettingsAction,
  updateInventoryFinanceSettingsAction,
  updateNotificationSettingsAction,
  switchLanguageAction,
} from "../actions";

const mockRevalidatePath = vi.fn();
const mockUpdateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) =>
    type ? mockRevalidatePath(path, type) : mockRevalidatePath(path),
  updateTag: (tag: string) => mockUpdateTag(tag),
}));

const mockSetCookie = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mockSetCookie,
  })),
}));

const testBusinessId = "11111111-1111-4111-8111-111111111111";
const otherBusinessId = "99999999-9999-4999-8999-999999999999";

let mockBusiness: Business = structuredClone(demoBusiness);

let mockSettings: BusinessSettings = structuredClone(demoSettings);

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

const authState = vi.hoisted(() => ({ role: "owner" as "owner" | "manager" | "staff" }));

vi.mock("@/features/auth", async () => {
  const domainAuth = await vi.importActual<typeof import("@/domain/auth")>("@/domain/auth");
  const requireAuthenticatedAction = vi.fn(async () => ({
    session: {
      user: {
        id: "00000000-0000-4000-8000-000000000002",
        email: "manager@test.com",
        name: "Marie Dupont",
        role: authState.role,
        businessId: testBusinessId,
      },
      business: {
        id: testBusinessId,
        name: "Les Saveurs du Continent",
        slug: "les-saveurs-du-continent",
        currency: "EUR",
      },
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
    businessId: testBusinessId,
  }));
  return {
    requireAuthenticatedAction,
    requireOwnerAction: vi.fn(async () => {
      const context = await requireAuthenticatedAction();
      if (context.session.user.role !== "owner") throw new domainAuth.OwnerRequiredError();
      return context;
    }),
  };
});

describe("Settings Server Actions", () => {
  beforeEach(() => {
    authState.role = "owner";
    vi.clearAllMocks();
  });

  describe("updateBusinessProfileAction", () => {
    it("rejects unauthenticated social link updates", async () => {
      vi.mocked(requireAuthenticatedAction).mockRejectedValueOnce(new Error("Unauthorized"));
      await expect(
        updateBusinessProfileAction({
          name: "Demo Shop",
          slug: "demo-shop",
          instagramUrl: "https://instagram.com/demoshop",
        }),
      ).rejects.toThrow("Unauthorized");
      expect(mockBusinessRepo.update).not.toHaveBeenCalled();
    });
    it("validates and persists all social links, including clearing them", async () => {
      const links = {
        instagramUrl: "https://instagram.com/demoshop",
        facebookUrl: "https://facebook.com/demoshop",
        tiktokUrl: "https://tiktok.com/@demoshop",
      };
      expect(
        await updateBusinessProfileAction({ name: "Demo Shop", slug: "demo-shop", ...links }),
      ).toMatchObject({ ok: true, data: links });
      expect(
        await updateBusinessProfileAction({
          name: "Demo Shop",
          slug: "demo-shop",
          instagramUrl: "",
          facebookUrl: "",
          tiktokUrl: "",
        }),
      ).toMatchObject({
        ok: true,
        data: { instagramUrl: "", facebookUrl: "", tiktokUrl: "" },
      });
      mockBusinessRepo.update.mockClear();
      expect(
        await updateBusinessProfileAction({
          name: "Demo Shop",
          slug: "demo-shop",
          instagramUrl: "http://example.com",
        }),
      ).toMatchObject({ ok: false, fieldErrors: { instagramUrl: expect.any(Array) } });
      expect(mockBusinessRepo.update).not.toHaveBeenCalled();
    });
    it("successfully updates business profile and revalidates paths", async () => {
      const updateData = {
        name: "Les Grandes Saveurs",
        slug: "les-grandes-saveurs",
        description: "New updated description",
        phone: "+33 1 99 88 77 66",
        email: "contact@example.com",
        whatsappNumber: "+33 6 99 88 77 66",
        address: "10 Rue Oberkampf, 75011 Paris",
        logoUrl: "https://example.com/new-logo.png",
      };

      const res = await updateBusinessProfileAction(updateData);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.name).toBe("Les Grandes Saveurs");
        expect(res.data.slug).toBe("les-grandes-saveurs");
        expect(res.data.description).toBe("New updated description");
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings/business");
      expect(mockUpdateTag).toHaveBeenCalledWith("storefront-catalog");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage");
    });

    it("rejects invalid inputs", async () => {
      const res = await updateBusinessProfileAction({
        name: "", // name is required
        slug: "INVALID SLUG!",
        email: "bad-email",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
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

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("already taken");
        expect(res.fieldErrors?.slug).toBeDefined();
      }
    });

    it("returns NOT_FOUND when the business no longer exists", async () => {
      mockBusinessRepo.findById.mockResolvedValueOnce(null);
      const res = await updateBusinessProfileAction({ name: "Test Name", slug: "test-name" });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe("NOT_FOUND");
      expect(mockBusinessRepo.update).not.toHaveBeenCalled();
    });

    it("handles repository Error exceptions in updateBusinessProfile", async () => {
      mockBusinessRepo.update.mockRejectedValueOnce(new Error("Profile update failed"));
      const res = await updateBusinessProfileAction({
        name: "Test Name",
        slug: "test-name",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INTERNAL");
      }
    });

    it("handles non-Error exceptions in updateBusinessProfile", async () => {
      mockBusinessRepo.update.mockRejectedValueOnce("Unknown profile failure");
      const res = await updateBusinessProfileAction({
        name: "Test Name",
        slug: "test-name",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INTERNAL");
      }
    });
  });

  describe("switchLanguageAction", () => {
    it("sets cookie for supported locale", async () => {
      const res = await switchLanguageAction("fr");
      expect(res.ok).toBe(true);
      expect(mockSetCookie).toHaveBeenCalledWith(
        "foodbiz_locale",
        "fr",
        expect.objectContaining({ path: "/" }),
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage");
    });

    it("rejects unsupported locale", async () => {
      const res = await switchLanguageAction("de");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("Unsupported locale");
      }
    });

    it("handles exception in switchLanguageAction", async () => {
      mockSetCookie.mockImplementationOnce(() => {
        throw new Error("Cookie failed");
      });
      const res = await switchLanguageAction("fr");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INTERNAL");
      }
    });

    it("handles non-Error exception in switchLanguageAction", async () => {
      mockSetCookie.mockImplementationOnce(() => {
        throw "Cookie error string";
      });
      const res = await switchLanguageAction("fr");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INTERNAL");
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
        leadTimeValue: 1,
        leadTimeUnit: "business_days",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.acceptingOrders).toBe(false);
        expect(res.data.serviceTypes?.delivery).toBe(false);
        expect(res.data.deliveryFee).toBe(500);
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings/ordering");
      expect(mockUpdateTag).toHaveBeenCalledWith("storefront-catalog");
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

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.fieldErrors).toBeDefined();
        expect(res.fieldErrors?.serviceTypes).toBeDefined();
      }
    });
  });

  describe("updateOrderingSettingsAction time zone (#168)", () => {
    const base = {
      acceptingOrders: true,
      serviceTypes: { pickup: true, delivery: true, dineIn: false },
      deliveryFee: 0,
      minOrderAmount: 0,
    };

    it("persists a valid IANA zone and revalidates the storefront", async () => {
      const res = await updateOrderingSettingsAction({ ...base, timezone: "Africa/Douala" });

      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.timezone).toBe("Africa/Douala");
      expect(mockUpdateTag).toHaveBeenCalledWith("storefront-catalog");
    });

    it("rejects an unknown zone with a field error", async () => {
      const res = await updateOrderingSettingsAction({ ...base, timezone: "Mars/Olympus_Mons" });

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.fieldErrors?.timezone).toBeDefined();
    });

    it("rejects an unauthenticated caller", async () => {
      vi.mocked(requireAuthenticatedAction).mockRejectedValueOnce(new Error("Unauthorized"));
      await expect(
        updateOrderingSettingsAction({ ...base, timezone: "Europe/Paris" }),
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("updateOrderingSettingsAction lead time (#225)", () => {
    const base = {
      acceptingOrders: true,
      serviceTypes: { pickup: true, delivery: true, dineIn: false },
      deliveryFee: 0,
      minOrderAmount: 0,
    };

    it("persists the lead time", async () => {
      const res = await updateOrderingSettingsAction({
        ...base,
        leadTimeValue: 3,
        leadTimeUnit: "hours",
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.leadTimeValue).toBe(3);
        expect(res.data.leadTimeUnit).toBe("hours");
      }
    });

    it("rejects an unknown unit and an out-of-range value", async () => {
      const res = await updateOrderingSettingsAction({
        ...base,
        leadTimeValue: 0,
        leadTimeUnit: "weeks",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.fieldErrors?.leadTimeValue).toBeDefined();
        expect(res.fieldErrors?.leadTimeUnit).toBeDefined();
      }
    });
  });

  describe("updatePaymentSettingsAction", () => {
    it("updates payment settings and revalidates paths", async () => {
      const res = await updatePaymentSettingsAction({
        revolutRevtag: "@pariskitchen",
        weroIdentifier: "+33698765432",
        paymentMethods: {
          cash: true,
          card: false,
          revolut: true,
          wero: false,
        },
        paymentInstructionsEn: "English instructions",
        paymentInstructionsFr: "Instructions francaises",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.revolutRevtag).toBe("@pariskitchen");
        expect(res.data.paymentMethods?.wero).toBe(false);
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings/payment");
      expect(mockUpdateTag).toHaveBeenCalledWith("storefront-catalog");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage");
    });

    it("accepts card-only payment settings", async () => {
      const res = await updatePaymentSettingsAction({
        revolutRevtag: "",
        weroIdentifier: "",
        paymentMethods: {
          cash: false,
          card: true,
          revolut: false,
          wero: false,
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.paymentMethods?.card).toBe(true);
      }
    });

    it("rejects when all payment methods are disabled", async () => {
      const res = await updatePaymentSettingsAction({
        revolutRevtag: "@rev",
        paymentMethods: {
          cash: false,
          card: false,
          revolut: false,
          wero: false,
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
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

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.lowStockThreshold).toBe(10);
        expect(res.data.taxPercentage).toBe(20);
        expect(res.data.dateFormat).toBe("YYYY-MM-DD");
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings/inventory-finance");
      expect(mockUpdateTag).toHaveBeenCalledWith("storefront-catalog");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings");
    });

    it("rejects invalid negative thresholds or invalid tax", async () => {
      const res = await updateInventoryFinanceSettingsAction({
        lowStockThreshold: -5,
        taxPercentage: 150,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
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

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.notifications).toBe(false);
        expect(res.data.soundAlerts).toBe(false);
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings/notifications");
      expect(mockUpdateTag).toHaveBeenCalledWith("storefront-catalog");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings");
    });

    it("rejects invalid notification input", async () => {
      const res = await updateNotificationSettingsAction({
        notifications: "invalid",
        inAppAlerts: 123,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
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
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INTERNAL");
      }
    });

    it("handles non-Error exceptions", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce("Unknown error");
      const res = await updateNotificationSettingsAction({
        notifications: true,
        inAppAlerts: true,
        soundAlerts: true,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INTERNAL");
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
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INTERNAL");
      }
    });

    it("handles non-Error exceptions in ordering settings", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce("Ordering failure");
      const res = await updateOrderingSettingsAction({
        acceptingOrders: true,
        serviceTypes: { pickup: true, delivery: true, dineIn: true },
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INTERNAL");
      }
    });

    it("handles repository Error exceptions in payment settings", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce(new Error("Payment write failed"));
      const res = await updatePaymentSettingsAction({
        paymentMethods: { cash: true, card: false, revolut: true, wero: true },
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INTERNAL");
      }
    });

    it("handles non-Error exceptions in payment settings", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce("Payment failure");
      const res = await updatePaymentSettingsAction({
        paymentMethods: { cash: true, card: false, revolut: true, wero: true },
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INTERNAL");
      }
    });

    it("handles repository Error exceptions in inventory & finance settings", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce(new Error("Inventory save error"));
      const res = await updateInventoryFinanceSettingsAction({
        lowStockThreshold: 10,
        taxPercentage: 20,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INTERNAL");
      }
    });

    it("handles non-Error exceptions in inventory & finance settings", async () => {
      mockBusinessRepo.updateSettings.mockRejectedValueOnce("Inventory failure");
      const res = await updateInventoryFinanceSettingsAction({
        lowStockThreshold: 10,
        taxPercentage: 20,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INTERNAL");
      }
    });
  });

  describe("owner-only settings", () => {
    const paymentInput = {
      revolutRevtag: "@intruder",
      weroIdentifier: "",
      paymentMethods: { cash: true, card: false, revolut: true, wero: true },
      paymentInstructionsEn: "",
      paymentInstructionsFr: "",
    };

    for (const role of ["manager", "staff"] as const) {
      it(`refuses payment settings to a ${role} with the FORBIDDEN code and writes nothing`, async () => {
        authState.role = role;
        expect(await updatePaymentSettingsAction(paymentInput)).toMatchObject({
          ok: false,
          code: "FORBIDDEN",
          message: "Only an owner can do this.",
        });
        expect(mockBusinessRepo.updateSettings).not.toHaveBeenCalled();
      });

      it(`refuses a slug change to a ${role} but lets them edit the rest of the profile`, async () => {
        authState.role = role;
        const changed = await updateBusinessProfileAction({
          name: demoBusiness.name,
          slug: "another-address",
        });
        expect(changed).toMatchObject({ ok: false, code: "FORBIDDEN" });
        expect(mockBusinessRepo.update).not.toHaveBeenCalled();

        const unchanged = await updateBusinessProfileAction({
          name: "Renamed Shop",
          slug: mockBusiness.slug,
        });
        expect(unchanged.ok).toBe(true);
        expect(mockBusinessRepo.update).toHaveBeenCalled();
      });
    }

    it("turns a database refusal into the FORBIDDEN code", async () => {
      const { OwnerRequiredError } = await import("@/domain/auth");
      mockBusinessRepo.updateSettings.mockRejectedValueOnce(new OwnerRequiredError());
      expect(await updatePaymentSettingsAction(paymentInput)).toMatchObject({
        ok: false,
        code: "FORBIDDEN",
      });
    });
  });
});
