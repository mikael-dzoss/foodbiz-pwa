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
import { MOCK_MANAGER_SESSION } from "@/domain/auth";
import { demoBusiness } from "@/lib/repositories/mock/fixtures";

const mockSession = {
  ...MOCK_MANAGER_SESSION,
  user: {
    ...MOCK_MANAGER_SESSION.user,
    role: "manager" as const,
  },
};

const mockBusiness = { ...demoBusiness };

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
  });

  it("renders BusinessProfilePage (M-62) and invokes requireManagerSession", async () => {
    const page = await BusinessProfilePage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("business-profile-form")).toBeDefined();
  });

  it("renders AboutPage (M-68) and invokes requireManagerSession", async () => {
    const page = await AboutPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("about-page")).toBeDefined();
  });

  it("renders OrderingSettingsPage (M-63) and invokes requireManagerSession", async () => {
    const page = await OrderingSettingsPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("ordering-settings-form")).toBeDefined();
  });

  it("renders PaymentSettingsPage (M-64) and invokes requireManagerSession", async () => {
    const page = await PaymentSettingsPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("payment-settings-form")).toBeDefined();
  });

  it("renders InventoryFinanceSettingsPage (M-65) and invokes requireManagerSession", async () => {
    const page = await InventoryFinanceSettingsPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("inventory-finance-form")).toBeDefined();
  });

  it("renders NotificationsSettingsPage (M-67) and invokes requireManagerSession", async () => {
    const page = await NotificationsSettingsPage();
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByTestId("notifications-app-form")).toBeDefined();
  });
});
