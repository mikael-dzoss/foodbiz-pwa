import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InventoryFinanceForm } from "../components/inventory-finance-form";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import type { BusinessSettings } from "@/domain/business";
import * as actions from "../actions";

const mockSettings: BusinessSettings = {
  businessId: "11111111-1111-4111-8111-111111111111",
  currency: "EUR",
  dateFormat: "DD/MM/YYYY",
  lowStockThreshold: 8,
  taxPercentage: 10,
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
  updateInventoryFinanceSettingsAction: vi.fn(async () => ({
    success: true,
    data: mockSettings,
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("InventoryFinanceForm component (M-65)", () => {
  it("renders form fields pre-populated with inventory and finance settings", () => {
    render(<InventoryFinanceForm settings={mockSettings} dict={dict} />);

    expect(screen.getByTestId("inventory-finance-form")).toBeDefined();
    expect(screen.getByText("M-65")).toBeDefined();
    expect(
      screen.getByRole("heading", { name: dict.inventoryFinance.title, level: 1 }),
    ).toBeDefined();

    expect((screen.getByTestId("input-low-stock-threshold") as HTMLInputElement).value).toBe("8");

    const categoryLink = screen.getByTestId("link-manage-categories");
    expect(categoryLink.getAttribute("href")).toBe("/manage/categories");

    expect(screen.getByTestId("badge-currency-readonly").textContent).toContain("EUR");
    expect((screen.getByTestId("input-tax-percentage") as HTMLInputElement).value).toBe("10");
  });

  it("handles discard button to reset changes", () => {
    render(<InventoryFinanceForm settings={mockSettings} dict={dict} />);

    const thresholdInput = screen.getByTestId("input-low-stock-threshold") as HTMLInputElement;
    fireEvent.change(thresholdInput, { target: { value: "15" } });
    expect(thresholdInput.value).toBe("15");

    const discardBtn = screen.getByTestId("discard-button");
    fireEvent.click(discardBtn);

    expect(thresholdInput.value).toBe("8");
    expect(mockShowToast).toHaveBeenCalledWith("Changes discarded");
  });

  it("submits updated inventory and finance settings successfully", async () => {
    render(<InventoryFinanceForm settings={mockSettings} dict={dict} />);

    const thresholdInput = screen.getByTestId("input-low-stock-threshold");
    fireEvent.change(thresholdInput, { target: { value: "12" } });

    const taxInput = screen.getByTestId("input-tax-percentage");
    fireEvent.change(taxInput, { target: { value: "5.5" } });

    const submitBtn = screen.getByTestId("save-inventory-finance-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.updateInventoryFinanceSettingsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          lowStockThreshold: 12,
          taxPercentage: 5.5,
        }),
      );
    });
  });

  it("displays server error when action returns an error", async () => {
    vi.mocked(actions.updateInventoryFinanceSettingsAction).mockResolvedValueOnce({
      success: false,
      error: "Failed to update settings",
      fieldErrors: {
        lowStockThreshold: ["Threshold must be positive"],
      },
    });

    render(<InventoryFinanceForm settings={mockSettings} dict={dict} />);

    const submitBtn = screen.getByTestId("save-inventory-finance-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Threshold must be positive")).toBeDefined();
    });
  });

  it("renders with fallback zero values and handles empty tax inputs", () => {
    const zeroSettings: BusinessSettings = {
      ...mockSettings,
      lowStockThreshold: 0,
      taxPercentage: 0,
    };
    render(<InventoryFinanceForm settings={zeroSettings} dict={dict} />);
    expect((screen.getByTestId("input-low-stock-threshold") as HTMLInputElement).value).toBe("0");
    expect((screen.getByTestId("input-tax-percentage") as HTMLInputElement).value).toBe("0");
  });

  it("displays toast error when action fails without fieldErrors", async () => {
    vi.mocked(actions.updateInventoryFinanceSettingsAction).mockResolvedValueOnce({
      success: false,
      error: "General database failure",
    });

    render(<InventoryFinanceForm settings={mockSettings} dict={dict} />);
    const submitBtn = screen.getByTestId("save-inventory-finance-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("General database failure");
    });
  });

  it("handles clearing input fields with fallback 0 and displays taxPercentage field error", async () => {
    vi.mocked(actions.updateInventoryFinanceSettingsAction).mockResolvedValueOnce({
      success: false,
      error: "Invalid tax value",
      fieldErrors: {
        taxPercentage: ["Tax rate cannot exceed 100%"],
      },
    });

    render(<InventoryFinanceForm settings={mockSettings} dict={dict} />);

    const thresholdInput = screen.getByTestId("input-low-stock-threshold");
    fireEvent.change(thresholdInput, { target: { value: "" } });

    const taxInput = screen.getByTestId("input-tax-percentage");
    fireEvent.change(taxInput, { target: { value: "" } });

    const submitBtn = screen.getByTestId("save-inventory-finance-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Tax rate cannot exceed 100%")).toBeDefined();
    });
  });
});
