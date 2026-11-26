import { describe, expect, it, vi, afterEach } from "vitest";
import { resetPwaInstallStore } from "@/lib/pwa/install-store";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationsAppForm } from "../components/notifications-app-form";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import type { BusinessSettings } from "@/domain/business";
import * as actions from "../actions";

const mockSettings: BusinessSettings = {
  businessId: "11111111-1111-4111-8111-111111111111",
  currency: "EUR",
  dateFormat: "DD/MM/YYYY",
  lowStockThreshold: 5,
  taxPercentage: 0,
  notifications: true,
  acceptingOrders: true,
  serviceTypes: {
    pickup: true,
    delivery: true,
    dineIn: true,
  },
  openingHours: "Mon-Sat 07:00-19:30",
  orderTimingAsap: true,
  orderTimingScheduled: true,
  orderTimingTimeOptional: true,
  deliveryFee: 350,
  minOrderAmount: 1500,
  leadTimeValue: 1,
  leadTimeUnit: "business_days",
  revolutRevtag: "saveurscontinent",
  weroIdentifier: "+33639980001",
  paymentMethods: {
    cash: true,
    card: false,
    revolut: true,
    wero: true,
  },
  paymentInstructionsEn: "Please present your order reference upon arrival.",
  paymentInstructionsFr: "Veuillez présenter votre référence de commande.",
  inAppAlerts: true,
  soundAlerts: true,
  timezone: "Europe/Paris",
};

const dict = getDictionary(DEFAULT_LOCALE).settings;

const mockShowToast = vi.fn();
const mockShowError = vi.fn();
vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...actual,
    useToast: () => ({
      showToast: mockShowToast,
      showError: mockShowError,
    }),
  };
});

vi.mock("../actions", () => ({
  updateNotificationSettingsAction: vi.fn(async () => ({
    ok: true,
    data: mockSettings,
  })),
}));

afterEach(() => {
  resetPwaInstallStore();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("NotificationsAppForm component (M-67)", () => {
  it("renders form fields pre-populated with notification settings", () => {
    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);

    expect(screen.getByTestId("notifications-app-form")).toBeDefined();
    expect(screen.getByRole("heading", { name: dict.notifications.title, level: 1 })).toBeDefined();

    expect(screen.getByTestId("switch-in-app-alerts")).toBeDefined();
    expect(screen.getByTestId("switch-sound-alerts")).toBeDefined();

    const aboutLink = screen.getByTestId("link-to-about");
    expect(aboutLink.getAttribute("href")).toBe("/manage/settings/about");
  });

  it("opens the shared install guide naming FoodBiz Manager when no native prompt is available", async () => {
    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);

    const installBtn = screen.getByTestId("button-install-pwa");
    fireEvent.click(installBtn);

    const dialog = await screen.findByRole("dialog", { name: "Install FoodBiz Manager" });
    expect(dialog).toBe(screen.getByTestId("manager-install-guide"));
    expect(screen.getByTestId("manager-install-guide-generic").textContent).toContain(
      "FoodBiz Manager",
    );
  });

  it("handles discard button to reset changes", () => {
    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);

    const inAppSwitch = screen.getByTestId("switch-in-app-alerts");
    fireEvent.click(inAppSwitch);

    const discardBtn = screen.getByTestId("discard-button");
    fireEvent.click(discardBtn);

    expect(mockShowToast).toHaveBeenCalledWith("Changes discarded");
  });

  it("submits updated notification settings successfully", async () => {
    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);

    const soundSwitch = screen.getByTestId("switch-sound-alerts");
    fireEvent.click(soundSwitch);

    const submitBtn = screen.getByTestId("save-notifications-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.updateNotificationSettingsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          soundAlerts: false,
          inAppAlerts: true,
          notifications: true,
        }),
      );
    });
  });

  it("displays server error when action returns error", async () => {
    vi.mocked(actions.updateNotificationSettingsAction).mockResolvedValueOnce({
      ok: false,
      code: "INTERNAL",
      message: "Failed to update notification preferences",
    });

    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);

    const submitBtn = screen.getByTestId("save-notifications-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith("Something went wrong. Please try again.");
    });
  });

  it("opens the shared install guide and prompts installation when beforeinstallprompt is captured", async () => {
    const mockPrompt = vi.fn(async () => {});
    const promptEvent = Object.assign(new Event("beforeinstallprompt"), {
      prompt: mockPrompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    });

    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);

    fireEvent(window, promptEvent);

    fireEvent.click(screen.getByTestId("button-install-pwa"));
    const primaryInstall = await screen.findByTestId("manager-install-guide-install-button");
    fireEvent.click(primaryInstall);

    await waitFor(() => {
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith("FoodBiz Manager installed");
    });
    await waitFor(() => expect(screen.queryByTestId("manager-install-app-card")).toBeNull());
  });

  it("handles user dismissing PWA install prompt inside the guide", async () => {
    const mockPrompt = vi.fn(async () => {});
    const promptEvent = Object.assign(new Event("beforeinstallprompt"), {
      prompt: mockPrompt,
      userChoice: Promise.resolve({ outcome: "dismissed" as const, platform: "web" }),
    });

    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);
    fireEvent(window, promptEvent);

    fireEvent.click(screen.getByTestId("button-install-pwa"));
    fireEvent.click(await screen.findByTestId("manager-install-guide-install-button"));

    await waitFor(() => {
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalledWith("FoodBiz Manager installed");
    });
    await waitFor(() => expect(screen.queryByTestId("manager-install-guide")).toBeNull());
  });

  it("hides the install card entirely when already in standalone mode while keeping About", () => {
    vi.stubGlobal("navigator", { ...navigator, standalone: true });

    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);

    expect(screen.queryByTestId("manager-install-app-card")).toBeNull();
    expect(screen.queryByTestId("button-install-pwa")).toBeNull();
    expect(screen.getByTestId("link-to-about")).toBeDefined();
  });

  it("shows iOS Safari Share steps in the manager install guide on iPadOS reporting as Mac", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
    });

    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);
    fireEvent.click(screen.getByTestId("button-install-pwa"));

    const steps = await screen.findByTestId("manager-install-guide-ios-safari");
    expect(steps.textContent).toContain("Add to Home Screen");
    expect(steps.textContent).toContain("FoodBiz Manager");
    expect(screen.getByTestId("manager-install-guide-ios-safari-share-icon")).toBeDefined();
  });

  it("handles toggling in-app alerts and renders fallback settings", async () => {
    const falseSettings = {
      ...mockSettings,
      inAppAlerts: false,
      soundAlerts: false,
    };
    render(<NotificationsAppForm settings={falseSettings} dict={dict} />);

    const inAppSwitch = screen.getByTestId("switch-in-app-alerts");
    fireEvent.click(inAppSwitch);

    const submitBtn = screen.getByTestId("save-notifications-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.updateNotificationSettingsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          inAppAlerts: true,
          soundAlerts: false,
        }),
      );
    });
  });
});
