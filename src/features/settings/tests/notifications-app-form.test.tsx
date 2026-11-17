import { describe, expect, it, vi, afterEach } from "vitest";
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
  revolutRevtag: "lapetiteboulangerie",
  weroIdentifier: "+33612345678",
  paymentMethods: {
    cash: true,
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
vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...actual,
    useToast: () => ({
      showToast: mockShowToast,
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
  vi.clearAllMocks();
});

describe("NotificationsAppForm component (M-67)", () => {
  it("renders form fields pre-populated with notification settings", () => {
    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);

    expect(screen.getByTestId("notifications-app-form")).toBeDefined();
    expect(screen.getByText("M-67")).toBeDefined();
    expect(screen.getByRole("heading", { name: dict.notifications.title, level: 1 })).toBeDefined();

    expect(screen.getByTestId("switch-in-app-alerts")).toBeDefined();
    expect(screen.getByTestId("switch-sound-alerts")).toBeDefined();

    const aboutLink = screen.getByTestId("link-to-about");
    expect(aboutLink.getAttribute("href")).toBe("/manage/settings/about");
  });

  it("handles PWA install click fallback guidance when not installed", () => {
    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);

    const installBtn = screen.getByTestId("button-install-pwa");
    fireEvent.click(installBtn);

    expect(mockShowToast).toHaveBeenCalledWith(
      "To install, tap Share or Menu in your browser, then 'Add to Home Screen'",
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
      expect(mockShowToast).toHaveBeenCalledWith("Something went wrong. Please try again.");
    });
  });

  it("prompts installation when beforeinstallprompt event is captured", async () => {
    const mockPrompt = vi.fn(async () => {});
    const promptEvent = Object.assign(new Event("beforeinstallprompt"), {
      prompt: mockPrompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    });

    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);

    fireEvent(window, promptEvent);

    const installBtn = screen.getByTestId("button-install-pwa");
    fireEvent.click(installBtn);

    await waitFor(() => {
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith("FoodBiz Manager PWA installed successfully");
    });
  });

  it("handles user dismissing PWA install prompt", async () => {
    const mockPrompt = vi.fn(async () => {});
    const promptEvent = Object.assign(new Event("beforeinstallprompt"), {
      prompt: mockPrompt,
      userChoice: Promise.resolve({ outcome: "dismissed" as const, platform: "web" }),
    });

    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);
    fireEvent(window, promptEvent);

    const installBtn = screen.getByTestId("button-install-pwa");
    fireEvent.click(installBtn);

    await waitFor(() => {
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalledWith("FoodBiz Manager PWA installed successfully");
    });
  });

  it("handles install click when already in standalone mode", () => {
    const originalNavigator = window.navigator;
    Object.defineProperty(window, "navigator", {
      value: { standalone: true },
      writable: true,
      configurable: true,
    });

    render(<NotificationsAppForm settings={mockSettings} dict={dict} />);

    expect(screen.getByTestId("badge-installed")).toBeDefined();
    const installBtn = screen.getByTestId("button-install-pwa");
    fireEvent.click(installBtn);

    expect(mockShowToast).toHaveBeenCalledWith("FoodBiz is already installed on this device");

    Object.defineProperty(window, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
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
