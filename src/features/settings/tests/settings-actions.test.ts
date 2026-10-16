import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Business, BusinessSettings } from "@/domain";
import {
  getBusinessProfileAction,
  getBusinessSettingsAction,
  updateBusinessProfileAction,
  switchLanguageAction,
} from "../actions";

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
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
  });
});
