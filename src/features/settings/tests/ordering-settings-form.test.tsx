import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrderingSettingsForm } from "../components/ordering-settings-form";
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
  deliveryFee: 350, // 3.50 EUR
  minOrderAmount: 1500, // 15.00 EUR
  leadTimeValue: 1,
  leadTimeUnit: "business_days" as const,
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
  updateOrderingSettingsAction: vi.fn(async () => ({
    ok: true,
    data: mockSettings,
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("OrderingSettingsForm component (M-63)", () => {
  it("renders form fields pre-populated with business settings", () => {
    render(<OrderingSettingsForm settings={mockSettings} dict={dict} />);

    expect(screen.getByTestId("ordering-settings-form")).toBeDefined();
    expect(screen.getByText("M-63")).toBeDefined();
    expect(screen.getByRole("heading", { name: dict.ordering.title, level: 1 })).toBeDefined();

    expect(screen.getByTestId("switch-accepting-orders")).toBeDefined();
    expect(screen.getByTestId("switch-service-pickup")).toBeDefined();
    expect(screen.getByTestId("switch-service-delivery")).toBeDefined();
    expect(screen.getByTestId("switch-service-dinein")).toBeDefined();
    expect(screen.queryByTestId("input-lead-time-note-en")).toBeNull();
    expect(screen.queryByTestId("input-lead-time-note-fr")).toBeNull();

    expect((screen.getByTestId("input-opening-hours") as HTMLInputElement).value).toBe(
      "Mon-Sat 07:00-19:30",
    );
    expect((screen.getByTestId("input-delivery-fee") as HTMLInputElement).value).toBe("3.50");
    expect((screen.getByTestId("input-min-order") as HTMLInputElement).value).toBe("15.00");
  });

  it("toggles accepting orders and updates status badge", () => {
    render(<OrderingSettingsForm settings={mockSettings} dict={dict} />);

    const badge = screen.getByTestId("store-status-badge");
    expect(badge.textContent).toContain("Live / Accepting");

    const switchBtn = screen.getByTestId("switch-accepting-orders");
    fireEvent.click(switchBtn);

    expect(badge.textContent).toContain("Paused");
  });

  it("handles discard button to reset changes", () => {
    render(<OrderingSettingsForm settings={mockSettings} dict={dict} />);

    const hoursInput = screen.getByTestId("input-opening-hours") as HTMLInputElement;
    fireEvent.change(hoursInput, { target: { value: "Closed permanently" } });
    expect(hoursInput.value).toBe("Closed permanently");

    const discardBtn = screen.getByTestId("discard-button");
    fireEvent.click(discardBtn);

    expect(hoursInput.value).toBe("Mon-Sat 07:00-19:30");
    expect(mockShowToast).toHaveBeenCalledWith("Changes discarded");
  });

  it("blocks submit and shows error if all fulfillment modes are disabled", () => {
    render(<OrderingSettingsForm settings={mockSettings} dict={dict} />);

    const pickupSwitch = screen.getByTestId("switch-service-pickup");
    const deliverySwitch = screen.getByTestId("switch-service-delivery");
    const dineInSwitch = screen.getByTestId("switch-service-dinein");

    fireEvent.click(pickupSwitch);
    fireEvent.click(deliverySwitch);
    fireEvent.click(dineInSwitch);

    const submitBtn = screen.getByTestId("save-ordering-button");
    fireEvent.click(submitBtn);

    expect(actions.updateOrderingSettingsAction).not.toHaveBeenCalled();
    expect(screen.getByText("At least one fulfillment mode must be enabled")).toBeDefined();
    expect(mockShowToast).toHaveBeenCalledWith("At least one fulfillment mode must be enabled");
  });

  it("submits updated ordering settings and converts euros to cents", async () => {
    render(<OrderingSettingsForm settings={mockSettings} dict={dict} />);

    const feeInput = screen.getByTestId("input-delivery-fee");
    fireEvent.change(feeInput, { target: { value: "4.20" } });

    const minOrderInput = screen.getByTestId("input-min-order");
    fireEvent.change(minOrderInput, { target: { value: "20.00" } });

    const submitBtn = screen.getByTestId("save-ordering-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.updateOrderingSettingsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryFee: 420,
          minOrderAmount: 2000,
          leadTimeValue: 1,
          leadTimeUnit: "business_days" as const,
          acceptingOrders: true,
          openingHours: "Mon-Sat 07:00-19:30",
        }),
      );
    });
  });

  it("displays server error when action returns an error", async () => {
    vi.mocked(actions.updateOrderingSettingsAction).mockResolvedValueOnce({
      ok: false,
      code: "INTERNAL",
      message: "Failed to update ordering settings",
      fieldErrors: {
        deliveryFee: ["Delivery fee cannot exceed 100 EUR"],
      },
    });

    render(<OrderingSettingsForm settings={mockSettings} dict={dict} />);

    const submitBtn = screen.getByTestId("save-ordering-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Delivery fee cannot exceed 100 EUR")).toBeDefined();
    });
  });

  it("renders with fallback values when settings fields are absent or false", () => {
    const fallbackSettings = {
      businessId: "11111111-1111-4111-8111-111111111111",
      currency: "EUR" as const,
      dateFormat: "DD/MM/YYYY" as const,
      lowStockThreshold: 0,
      taxPercentage: 0,
      notifications: false,
      acceptingOrders: false,
      serviceTypes: { pickup: false, delivery: true, dineIn: false },
      openingHours: "",
      orderTimingAsap: false,
      orderTimingScheduled: false,
      orderTimingTimeOptional: false,
      deliveryFee: 0,
      minOrderAmount: 0,
      leadTimeValue: 1,
      leadTimeUnit: "business_days" as const,
      revolutRevtag: "",
      weroIdentifier: "",
      paymentMethods: { cash: true, revolut: false, wero: false },
      paymentInstructionsEn: "",
      paymentInstructionsFr: "",
      inAppAlerts: false,
      soundAlerts: false,
      timezone: "Europe/Paris",
    };

    render(<OrderingSettingsForm settings={fallbackSettings} dict={dict} />);
    expect(screen.getByTestId("store-status-badge").textContent).toContain("Paused");
  });

  it("toggles order timing switches", async () => {
    render(<OrderingSettingsForm settings={mockSettings} dict={dict} />);

    const asapSwitch = screen.getByTestId("switch-timing-asap");
    const schedSwitch = screen.getByTestId("switch-timing-scheduled");
    const optSwitch = screen.getByTestId("switch-timing-time-optional");

    fireEvent.click(asapSwitch);
    fireEvent.click(schedSwitch);
    fireEvent.click(optSwitch);

    const submitBtn = screen.getByTestId("save-ordering-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.updateOrderingSettingsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          orderTimingAsap: false,
          orderTimingScheduled: false,
          orderTimingTimeOptional: false,
        }),
      );
    });
  });

  it("displays minOrderAmount field error", async () => {
    vi.mocked(actions.updateOrderingSettingsAction).mockResolvedValueOnce({
      ok: false,
      code: "INTERNAL",
      message: "Validation failed",
      fieldErrors: {
        minOrderAmount: ["Minimum order must be positive"],
      },
    });

    render(<OrderingSettingsForm settings={mockSettings} dict={dict} />);
    const submitBtn = screen.getByTestId("save-ordering-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Minimum order must be positive")).toBeDefined();
    });
  });

  it("handles clearing numeric inputs and fallback action failure toast", async () => {
    vi.mocked(actions.updateOrderingSettingsAction).mockResolvedValueOnce({
      ok: false,
      code: "INTERNAL",
      message: "",
    });

    render(<OrderingSettingsForm settings={mockSettings} dict={dict} />);

    const feeInput = screen.getByTestId("input-delivery-fee");
    fireEvent.change(feeInput, { target: { value: "" } });

    const minOrderInput = screen.getByTestId("input-min-order");
    fireEvent.change(minOrderInput, { target: { value: "" } });

    const submitBtn = screen.getByTestId("save-ordering-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.updateOrderingSettingsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryFee: 0,
          minOrderAmount: 0,
          leadTimeValue: 1,
          leadTimeUnit: "business_days" as const,
        }),
      );
      expect(mockShowToast).toHaveBeenCalledWith("Something went wrong. Please try again.");
    });
  });

  it("edits the preparation lead time with a live preview and submits it (#225)", async () => {
    render(<OrderingSettingsForm settings={mockSettings} dict={dict} />);

    expect(screen.getByTestId("lead-time-preview").textContent).toBe(
      "Customers will see: Ready in ~1 business day",
    );

    fireEvent.change(screen.getByTestId("input-lead-time-value"), { target: { value: "20" } });
    fireEvent.change(screen.getByTestId("select-lead-time-unit"), {
      target: { value: "minutes" },
    });
    expect(screen.getByTestId("lead-time-preview").textContent).toBe(
      "Customers will see: Ready in ~20 min",
    );

    fireEvent.change(screen.getByTestId("select-lead-time-unit"), { target: { value: "bogus" } });
    expect((screen.getByTestId("select-lead-time-unit") as HTMLSelectElement).value).toBe(
      "minutes",
    );

    fireEvent.click(screen.getByTestId("save-ordering-button"));
    await waitFor(() =>
      expect(actions.updateOrderingSettingsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          leadTimeValue: 20,
          leadTimeUnit: "minutes",
        }),
      ),
    );
  });

  it("hides the lead time preview for invalid values and resets on discard (#225)", () => {
    render(<OrderingSettingsForm settings={mockSettings} dict={dict} locale="fr" />);
    expect(screen.getByTestId("lead-time-preview").textContent).toContain("~1 jour ouvré");

    fireEvent.change(screen.getByTestId("input-lead-time-value"), { target: { value: "0" } });
    expect(screen.queryByTestId("lead-time-preview")).toBeNull();

    fireEvent.click(screen.getByTestId("discard-button"));
    expect((screen.getByTestId("input-lead-time-value") as HTMLInputElement).value).toBe("1");
    expect(screen.getByTestId("lead-time-preview")).toBeDefined();
  });

  it("shows a lead time field error returned by the action (#225)", async () => {
    vi.mocked(actions.updateOrderingSettingsAction).mockResolvedValueOnce({
      ok: false,
      code: "INTERNAL",
      message: "Validation failed",
      fieldErrors: { leadTimeValue: ["Lead time must be at least 1"] },
    });
    render(<OrderingSettingsForm settings={mockSettings} dict={dict} />);
    fireEvent.click(screen.getByTestId("save-ordering-button"));
    await waitFor(() => expect(screen.getByText("Lead time must be at least 1")).toBeDefined());
  });

  it("edits the business time zone and submits it (#168)", async () => {
    render(<OrderingSettingsForm settings={mockSettings} dict={dict} />);

    const select = screen.getByTestId("select-timezone") as HTMLSelectElement;
    expect(select.value).toBe("Europe/Paris");
    expect(screen.getByText(dict.ordering.timezoneHelper)).toBeDefined();

    fireEvent.change(select, { target: { value: "Asia/Tokyo" } });
    fireEvent.click(screen.getByTestId("discard-button"));
    expect(select.value).toBe("Europe/Paris");

    fireEvent.change(select, { target: { value: "Africa/Douala" } });
    fireEvent.click(screen.getByTestId("save-ordering-button"));
    await waitFor(() =>
      expect(actions.updateOrderingSettingsAction).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: "Africa/Douala" }),
      ),
    );
  });

  it("keeps a saved zone that is not in the shortlist selectable (#168)", () => {
    render(
      <OrderingSettingsForm
        settings={{ ...mockSettings, timezone: "Asia/Tokyo" }}
        dict={dict}
        locale="fr"
      />,
    );
    expect((screen.getByTestId("select-timezone") as HTMLSelectElement).value).toBe("Asia/Tokyo");
  });
});
