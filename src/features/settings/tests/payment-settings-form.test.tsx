import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { PaymentSettingsForm } from "../components/payment-settings-form";
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
  updatePaymentSettingsAction: vi.fn(async () => ({
    success: true,
    data: mockSettings,
  })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PaymentSettingsForm component (M-64)", () => {
  it("renders form fields pre-populated with payment settings", () => {
    render(<PaymentSettingsForm settings={mockSettings} dict={dict} />);

    expect(screen.getByTestId("payment-settings-form")).toBeDefined();
    expect(screen.getByText("M-64")).toBeDefined();
    expect(screen.getByRole("heading", { name: dict.payment.title, level: 1 })).toBeDefined();

    expect((screen.getByTestId("input-revolut-revtag") as HTMLInputElement).value).toBe(
      "lapetiteboulangerie",
    );
    expect((screen.getByTestId("input-wero-identifier") as HTMLInputElement).value).toBe(
      "+33612345678",
    );

    expect(screen.getByTestId("switch-payment-cash")).toBeDefined();
    expect(screen.getByTestId("switch-payment-revolut")).toBeDefined();
    expect(screen.getByTestId("switch-payment-wero")).toBeDefined();

    expect((screen.getByTestId("textarea-instructions-en") as HTMLTextAreaElement).value).toBe(
      "Please present your order reference upon arrival.",
    );
  });

  it("switches instruction language tabs back and forth", () => {
    render(<PaymentSettingsForm settings={mockSettings} dict={dict} />);

    const frTab = screen.getByTestId("tab-instructions-fr");
    fireEvent.click(frTab);

    const frTextarea = screen.getByTestId("textarea-instructions-fr") as HTMLTextAreaElement;
    expect(frTextarea.value).toBe("Veuillez présenter votre référence de commande.");

    const enTab = screen.getByTestId("tab-instructions-en");
    fireEvent.click(enTab);

    const enTextarea = screen.getByTestId("textarea-instructions-en") as HTMLTextAreaElement;
    expect(enTextarea.value).toBe("Please present your order reference upon arrival.");
  });

  it("handles discard button to reset changes", () => {
    render(<PaymentSettingsForm settings={mockSettings} dict={dict} />);

    const revtagInput = screen.getByTestId("input-revolut-revtag") as HTMLInputElement;
    fireEvent.change(revtagInput, { target: { value: "modifiedtag" } });
    expect(revtagInput.value).toBe("modifiedtag");

    const discardBtn = screen.getByTestId("discard-button");
    fireEvent.click(discardBtn);

    expect(revtagInput.value).toBe("lapetiteboulangerie");
    expect(mockShowToast).toHaveBeenCalledWith("Changes discarded");
  });

  it("blocks submit and shows error if all payment methods are disabled", () => {
    render(<PaymentSettingsForm settings={mockSettings} dict={dict} />);

    const cashSwitch = screen.getByTestId("switch-payment-cash");
    const revolutSwitch = screen.getByTestId("switch-payment-revolut");
    const weroSwitch = screen.getByTestId("switch-payment-wero");

    fireEvent.click(cashSwitch);
    fireEvent.click(revolutSwitch);
    fireEvent.click(weroSwitch);

    const submitBtn = screen.getByTestId("save-payment-button");
    fireEvent.click(submitBtn);

    expect(actions.updatePaymentSettingsAction).not.toHaveBeenCalled();
    expect(screen.getByTestId("error-payment-methods")).toBeDefined();
    expect(mockShowToast).toHaveBeenCalledWith(dict.payment.atLeastOneMethodError);
  });

  it("submits updated payment settings successfully", async () => {
    render(<PaymentSettingsForm settings={mockSettings} dict={dict} />);

    const revtagInput = screen.getByTestId("input-revolut-revtag");
    fireEvent.change(revtagInput, { target: { value: "newboulangerietag" } });

    const submitBtn = screen.getByTestId("save-payment-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.updatePaymentSettingsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          revolutRevtag: "newboulangerietag",
          weroIdentifier: "+33612345678",
          paymentMethods: {
            cash: true,
            revolut: true,
            wero: true,
          },
        }),
      );
    });
  });

  it("displays server error when action fails", async () => {
    vi.mocked(actions.updatePaymentSettingsAction).mockResolvedValueOnce({
      success: false,
      error: "Failed to update payment settings",
    });

    render(<PaymentSettingsForm settings={mockSettings} dict={dict} />);

    const submitBtn = screen.getByTestId("save-payment-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("Failed to update payment settings");
    });
  });

  it("renders with fallback values when settings fields are empty", () => {
    const emptySettings: BusinessSettings = {
      ...mockSettings,
      revolutRevtag: "",
      weroIdentifier: "",
      paymentInstructionsEn: "",
      paymentInstructionsFr: "",
      paymentMethods: { cash: false, revolut: true, wero: false },
    };
    render(<PaymentSettingsForm settings={emptySettings} dict={dict} />);
    expect((screen.getByTestId("input-revolut-revtag") as HTMLInputElement).value).toBe("");
  });

  it("edits English and French instructions and submits", async () => {
    render(<PaymentSettingsForm settings={mockSettings} dict={dict} />);

    const enTextarea = screen.getByTestId("textarea-instructions-en");
    fireEvent.change(enTextarea, { target: { value: "Updated EN instructions" } });

    const frTab = screen.getByTestId("tab-instructions-fr");
    fireEvent.click(frTab);

    const frTextarea = screen.getByTestId("textarea-instructions-fr");
    fireEvent.change(frTextarea, { target: { value: "Updated FR instructions" } });

    const submitBtn = screen.getByTestId("save-payment-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.updatePaymentSettingsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentInstructionsEn: "Updated EN instructions",
          paymentInstructionsFr: "Updated FR instructions",
        }),
      );
    });
  });

  it("displays field error when action returns fieldErrors", async () => {
    vi.mocked(actions.updatePaymentSettingsAction).mockResolvedValueOnce({
      success: false,
      error: "Validation error",
      fieldErrors: {
        paymentMethods: ["Please select at least one method"],
      },
    });

    render(<PaymentSettingsForm settings={mockSettings} dict={dict} />);
    const submitBtn = screen.getByTestId("save-payment-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("error-payment-methods")).toBeDefined();
    });
  });
});
