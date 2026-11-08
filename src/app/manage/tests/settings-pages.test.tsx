import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsPage from "../(authenticated)/settings/page";
import AccountSettingsPage from "../(authenticated)/settings/account/page";
import BusinessProfilePage from "../(authenticated)/settings/business/page";
import AboutPage from "../(authenticated)/settings/about/page";
import OrderingSettingsPage from "../(authenticated)/settings/ordering/page";
import PaymentSettingsPage from "../(authenticated)/settings/payment/page";
import InventoryFinanceSettingsPage from "../(authenticated)/settings/inventory-finance/page";
import NotificationsSettingsPage from "../(authenticated)/settings/notifications/page";
import * as auth from "@/lib/auth";

const mockSession = {
  user: {
    id: "00000000-0000-4000-8000-000000000002",
    email: "manager@lapetiteboulangerie.fr",
    name: "Marie Dupont",
    role: "manager" as const,
    businessId: "11111111-1111-4111-8111-111111111111",
  },
  business: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "La Petite Boulangerie",
    slug: "la-petite-boulangerie",
    currency: "EUR" as const,
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
};

const mockBusiness = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "La Petite Boulangerie",
  slug: "la-petite-boulangerie",
  currency: "EUR" as const,
  description: "Artisanal organic sourdough bakery",
  phone: "+33 1 43 55 67 89",
  email: "bonjour@lapetiteboulangerie.fr",
  whatsappNumber: "+33 6 12 34 56 78",
  address: "12 Rue de la Roquette, 75011 Paris",
  logoUrl: null,
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-01T08:00:00.000Z",
};

afterEach(() => {
  vi.clearAllMocks();
});

vi.mock("@/lib/auth", () => ({
  requireManagerSession: vi.fn(async () => mockSession),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => ({ value: "en" })),
    set: vi.fn(),
  })),
}));

vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...actual,
    useToast: () => ({
      showToast: vi.fn(),
    }),
  };
});

vi.mock("@/components/theme", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/theme")>();
  return {
    ...actual,
    useTheme: () => ({
      theme: "system",
      resolvedTheme: "light",
      setTheme: vi.fn(),
      mounted: true,
    }),
  };
});

vi.mock("@/features/settings/actions", () => ({
  getBusinessProfileAction: vi.fn(async () => ({
    success: true,
    data: mockBusiness,
  })),
  getBusinessSettingsAction: vi.fn(async () => ({
    success: true,
    data: null,
  })),
  updateBusinessProfileAction: vi.fn(async () => ({
    success: true,
    data: mockBusiness,
  })),
  switchLanguageAction: vi.fn(async (l: string) => ({
    success: true,
    data: l,
  })),
}));

describe("Settings Pages Route Guards and Rendering", () => {
  it("renders SettingsPage (M-60) and invokes requireManagerSession", async () => {
    const page = await SettingsPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("settings-hub")).toBeDefined();
    expect(screen.getByText("Marie Dupont")).toBeDefined();
  });

  it("renders AccountSettingsPage (M-61) and invokes requireManagerSession", async () => {
    const page = await AccountSettingsPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("account-settings")).toBeDefined();
    expect(screen.getByText("M-61")).toBeDefined();
  });

  it("renders BusinessProfilePage (M-62) and invokes requireManagerSession", async () => {
    const page = await BusinessProfilePage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("business-profile-form")).toBeDefined();
    expect(screen.getByText("M-62")).toBeDefined();
  });

  it("renders AboutPage (M-68) and invokes requireManagerSession", async () => {
    const page = await AboutPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("about-page")).toBeDefined();
    expect(screen.getByText("M-68")).toBeDefined();
  });

  it("renders OrderingSettingsPage (M-63) and invokes requireManagerSession", async () => {
    const page = await OrderingSettingsPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("ordering-settings-form")).toBeDefined();
    expect(screen.getByText("M-63")).toBeDefined();
  });

  it("renders PaymentSettingsPage (M-64) and invokes requireManagerSession", async () => {
    const page = await PaymentSettingsPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("payment-settings-form")).toBeDefined();
    expect(screen.getByText("M-64")).toBeDefined();
  });

  it("renders InventoryFinanceSettingsPage (M-65) and invokes requireManagerSession", async () => {
    const page = await InventoryFinanceSettingsPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("inventory-finance-form")).toBeDefined();
    expect(screen.getByText("M-65")).toBeDefined();
  });

  it("renders NotificationsSettingsPage (M-67) and invokes requireManagerSession", async () => {
    const page = await NotificationsSettingsPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("notifications-app-form")).toBeDefined();
    expect(screen.getByText("M-67")).toBeDefined();
  });
});
