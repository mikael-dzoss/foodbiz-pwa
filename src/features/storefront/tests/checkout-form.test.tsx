import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/domain/i18n";
import { CartProvider, resetCartStore, SERVICE_MODE_STORAGE_KEY } from "../context/cart-context";
import { CheckoutView } from "../components/checkout-view";
import { CheckoutForm, resetGuestContactCache } from "../components/checkout-form";
import { GUEST_CONTACT_STORAGE_KEY, mapCheckoutIssueToDictKey } from "@/domain/checkout";
import { DEMO_PRODUCT, demoBusiness } from "@/lib/repositories/mock/fixtures";
import type { BusinessSettings } from "@/domain/business";
import type { StorefrontBusiness } from "@/domain/storefront-business";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  usePathname: () => "/en/checkout",
}));

const dict = getDictionary("en").storefront;

const mockBusiness: StorefrontBusiness = {
  name: demoBusiness.name,
  description: demoBusiness.description,
  phone: demoBusiness.phone,
  email: demoBusiness.email,
  whatsappNumber: demoBusiness.whatsappNumber,
  address: demoBusiness.address,
};

const mockSettings: BusinessSettings = {
  businessId: "biz-1",
  currency: "EUR",
  dateFormat: "DD/MM/YYYY",
  lowStockThreshold: 5,
  taxPercentage: 10,
  notifications: true,
  acceptingOrders: true,
  serviceTypes: {
    pickup: true,
    delivery: true,
    dineIn: false,
  },
  openingHours: "07:00 - 19:30",
  orderTimingAsap: true,
  orderTimingScheduled: true,
  orderTimingTimeOptional: true,
  deliveryFee: 250,
  minOrderAmount: 0,
  leadTimeValue: 1,
  leadTimeUnit: "business_days",
  revolutRevtag: "saveurscontinent",
  weroIdentifier: "wero@example.com",
  paymentMethods: {
    cash: true,
    card: false,
    revolut: true,
    wero: true,
  },
  paymentInstructionsEn: "Please settle payment upon collection.",
  paymentInstructionsFr: "Règlement au comptoir.",
  inAppAlerts: true,
  soundAlerts: true,
  timezone: "Europe/Paris",
};

const mockCartItems = [
  {
    productId: "p1",
    name: DEMO_PRODUCT.pouletBraise.name,
    price: 220,
    quantity: 2,
    maxStock: 5,
    imageUrl: null,
  },
];

describe("CheckoutView & CheckoutForm", () => {
  beforeEach(() => {
    // Slot lists (#374) depend on the clock; pin Date only so waitFor timers keep working.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-26T10:00:00Z"));
    resetCartStore();
    resetGuestContactCache();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetCartStore();
    resetGuestContactCache();
    localStorage.clear();
  });

  it.each([
    ["@saveurscontinent", "@saveurscontinent"],
    ["saveurscontinent", "@saveurscontinent"],
  ])("shows the Revolut tag %s with a single leading @", (revtag, shown) => {
    render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={{ ...mockSettings, revolutRevtag: revtag }}
          locale="en"
          dict={dict}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );
    expect(screen.getByTestId("checkout-revolut-tag").textContent).toBe(shown);
  });

  it("hides the Revolut tag line when no tag is configured", () => {
    render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={{ ...mockSettings, revolutRevtag: "" }}
          locale="en"
          dict={dict}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );
    expect(screen.queryByTestId("checkout-revolut-tag")).toBeNull();
  });

  it("renders empty cart notice when items are empty", () => {
    render(
      <CartProvider initialItems={[]}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
        />
      </CartProvider>,
    );

    expect(screen.getByText(dict.emptyCartTitle)).toBeDefined();
    expect(screen.queryByTestId("checkout-form")).toBeNull();
  });

  it("keeps the place-order bar in the page flow above the footer (#237)", () => {
    render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
        />
      </CartProvider>,
    );
    const bar = screen.getByTestId("checkout-action-bar");
    expect(bar.className).toContain("sticky");
    expect(bar.className).not.toMatch(/\bfixed\b/);
    expect(bar.contains(screen.getByTestId("place-order-button"))).toBe(true);
    expect(screen.getByTestId("checkout-form").className).not.toContain("pb-28");
  });

  it("renders checkout form with sections when items are present", () => {
    render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    expect(screen.getByTestId("checkout-form")).toBeDefined();
    expect(screen.getByText(dict.customerContact)).toBeDefined();
    expect(screen.getByText(dict.fulfillmentMode)).toBeDefined();
    expect(screen.getByText(dict.orderTiming)).toBeDefined();
    expect(screen.getByText(dict.paymentMethod)).toBeDefined();
    expect(screen.getByText(dict.orderNotes)).toBeDefined();
  });

  it("prefills from localStorage, locks name field, and displays saved-name toast", () => {
    localStorage.setItem(
      GUEST_CONTACT_STORAGE_KEY,
      JSON.stringify({ name: "Marie Dupont", phone: "+33612345678" }),
    );

    render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    const nameInput = screen.getByTestId("checkout-name-input") as HTMLInputElement;
    expect(nameInput.value).toBe("Marie Dupont");
    expect(nameInput.disabled).toBe(true);

    const phoneInput = screen.getByTestId("checkout-phone-input") as HTMLInputElement;
    expect(phoneInput.value).toBe("+33612345678");

    // Toast notice
    expect(screen.getByTestId("saved-name-toast")).toBeDefined();
    expect(screen.getByText(dict.savedNameNotice)).toBeDefined();
  });

  it("unlocks name field when Edit button is clicked", () => {
    localStorage.setItem(
      GUEST_CONTACT_STORAGE_KEY,
      JSON.stringify({ name: "Marie Dupont", phone: "+33612345678" }),
    );

    render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    const unlockBtn = screen.getByTestId("unlock-name-button");
    fireEvent.click(unlockBtn);

    const nameInput = screen.getByTestId("checkout-name-input") as HTMLInputElement;
    expect(nameInput.disabled).toBe(false);
    expect(screen.queryByTestId("saved-name-toast")).toBeNull();
  });

  it("shows delivery address field when Local Delivery is selected and hides it for Pickup", () => {
    render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    // Default delivery when delivery is enabled (#193)
    expect(screen.getByTestId("delivery-address-container")).toBeDefined();

    // Select pickup
    const pickupBtn = screen.getByTestId("service-pickup-button");
    fireEvent.click(pickupBtn);
    expect(screen.queryByTestId("delivery-address-container")).toBeNull();

    // Select delivery again
    const deliveryBtn = screen.getByTestId("service-delivery-button");
    fireEvent.click(deliveryBtn);

    expect(screen.getByTestId("delivery-address-container")).toBeDefined();
    expect(screen.getByTestId("checkout-address-input")).toBeDefined();
  });

  it("preselects persisted service mode from localStorage if enabled, and falls back when disabled (#193)", () => {
    localStorage.setItem(SERVICE_MODE_STORAGE_KEY, "pickup");

    const { unmount } = render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
        />
      </CartProvider>,
    );

    expect(screen.getByTestId("service-pickup-button").getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByTestId("delivery-address-container")).toBeNull();
    unmount();

    // If persisted mode is delivery, but delivery is disabled in settings -> falls back to pickup
    resetCartStore();
    localStorage.setItem(SERVICE_MODE_STORAGE_KEY, "delivery");
    render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={{
            ...mockSettings,
            serviceTypes: { pickup: true, delivery: false, dineIn: false },
          }}
          locale="en"
          dict={dict}
        />
      </CartProvider>,
    );

    expect(screen.getByTestId("service-pickup-button").getAttribute("aria-checked")).toBe("true");
  });

  it("shows date and time pickers when Schedule for Later is selected", () => {
    render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    // Default ASAP, labelled with the manager lead time (#226)
    expect(screen.queryByTestId("scheduled-timing-inputs")).toBeNull();
    expect(screen.getByTestId("timing-asap-option").textContent).toContain(
      "ASAP (~1 business day)",
    );
    // #234 / #377: pay-on-handover copy matches enabled methods (cash only in mockSettings)
    expect(screen.getByText("Pay in cash when you receive your order")).toBeDefined();
    expect(screen.getByText("QR or alias")).toBeDefined();
    expect(screen.getByText("Instant SEPA transfer")).toBeDefined();

    // Select Schedule Later
    const scheduleOption = screen.getByTestId("timing-scheduled-option");
    fireEvent.click(scheduleOption);

    expect(screen.getByTestId("scheduled-timing-inputs")).toBeDefined();
    const dateInput = screen.getByTestId("checkout-date-input");
    const timeInput = screen.getByTestId("checkout-time-input");
    expect(dateInput.className).toContain("w-full");
    expect(dateInput.className).toContain("min-w-0");
    expect(timeInput.className).toContain("w-full");
    expect(timeInput.className).toContain("min-w-0");
  });

  it("keeps Place Order button enabled with an invalid form and disables it when cart is empty or submitting (#351)", async () => {
    const onSubmitOrder = vi.fn();

    const { unmount } = render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          onSubmitOrder={onSubmitOrder}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    const submitBtn = screen.getByTestId("place-order-button") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);

    // No errors on initial render
    expect(screen.queryByRole("alert")).toBeNull();

    // Tapping Place Order with invalid fields submits nothing and surfaces per-field errors
    fireEvent.click(submitBtn);
    expect(onSubmitOrder).not.toHaveBeenCalled();
    expect(screen.getByTestId("checkout-name-field-error").textContent).toBe(
      dict.nameRequiredError,
    );
    expect(screen.getByTestId("checkout-phone-field-error").textContent).toBe(
      dict.phoneRequiredError,
    );
    expect(screen.queryByTestId("checkout-error-feedback")).toBeNull();

    unmount();

    // Empty cart disables Place Order when CheckoutForm is rendered directly
    const { unmount: unmountEmpty } = render(
      <CartProvider initialItems={[]} initialServiceMode="pickup">
        <CheckoutForm business={mockBusiness} settings={mockSettings} locale="en" dict={dict} />
      </CartProvider>,
    );
    expect((screen.getByTestId("place-order-button") as HTMLButtonElement).disabled).toBe(true);
    unmountEmpty();
    resetCartStore();

    // Submitting state disables Place Order while request is in flight
    let resolveSubmit: (() => void) | undefined;
    const pendingSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
        <CheckoutForm
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          onSubmitOrder={pendingSubmit}
        />
      </CartProvider>,
    );

    const submitBtnWhilePending = screen.getByTestId("place-order-button") as HTMLButtonElement;
    fireEvent.change(screen.getByTestId("checkout-name-input"), {
      target: { value: "Léa Martin" },
    });
    fireEvent.change(screen.getByTestId("checkout-phone-input"), {
      target: { value: "+33612345678" },
    });
    fireEvent.submit(screen.getByTestId("checkout-form"));

    await waitFor(() => {
      expect(submitBtnWhilePending.disabled).toBe(true);
    });
    resolveSubmit?.();
    await waitFor(() => {
      expect(pendingSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it("shows errors under each invalid field, sets ARIA attributes, and scrolls + focuses the first invalid field in DOM order (#351)", () => {
    const onSubmitOrder = vi.fn();
    const scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });

    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="delivery">
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          onSubmitOrder={onSubmitOrder}
        />
      </CartProvider>,
    );

    // Switch to scheduled so requestedDate is also required
    fireEvent.click(screen.getByTestId("timing-scheduled-option"));
    // Make notes exceed 500 chars
    const notesInput = screen.getByTestId("checkout-notes-input");
    fireEvent.change(notesInput, { target: { value: "x".repeat(501) } });

    // Live region is silent before submit
    const liveSummary = screen.getByTestId("checkout-validation-summary");
    expect(liveSummary.getAttribute("aria-live")).toBe("polite");
    expect(liveSummary.className).toContain("sr-only");
    expect(liveSummary.textContent).toBe("");

    fireEvent.click(screen.getByTestId("place-order-button"));
    expect(onSubmitOrder).not.toHaveBeenCalled();

    // Single polite live region announces localized summary without per-field role="alert" double announcements
    expect(liveSummary.textContent).toBe(dict.formValidationSummary);
    expect(screen.queryByRole("alert")).toBeNull();

    const nameInput = screen.getByTestId("checkout-name-input");
    const phoneInput = screen.getByTestId("checkout-phone-input");
    const addressInput = screen.getByTestId("checkout-address-input");
    const dateInput = screen.getByTestId("checkout-date-input");

    // First invalid in DOM order is name
    expect(document.activeElement).toBe(nameInput);
    expect(scrollIntoViewMock).toHaveBeenCalled();

    // Every invalid field has its localized error, aria-invalid="true", and aria-describedby -> error id
    for (const [input, errorTestId, expectedText] of [
      [nameInput, "checkout-name-field-error", dict.nameRequiredError],
      [phoneInput, "checkout-phone-field-error", dict.phoneRequiredError],
      [addressInput, "delivery-address-container-error", dict.addressRequiredError],
      [dateInput, "checkout-date-field-error", dict.dateRequiredError],
      [notesInput, "checkout-notes-field-error", dict.notesTooLongError],
    ] as const) {
      const errorEl = screen.getByTestId(errorTestId);
      expect(errorEl.getAttribute("role")).toBeNull();
      expect(errorEl.textContent).toBe(expectedText);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      const describedByIds = (input.getAttribute("aria-describedby") ?? "").split(/\s+/);
      expect(describedByIds).toContain(errorEl.id);
    }

    // Fix name, submit again -> phone is now the first invalid field focused
    fireEvent.change(nameInput, { target: { value: "Léa Martin" } });
    expect(screen.queryByTestId("checkout-name-field-error")).toBeNull();
    expect(nameInput.hasAttribute("aria-invalid")).toBe(false);

    fireEvent.click(screen.getByTestId("place-order-button"));
    expect(document.activeElement).toBe(phoneInput);

    // Fix phone, submit again -> deliveryAddress is now focused
    fireEvent.change(phoneInput, { target: { value: "+33612345678" } });
    fireEvent.click(screen.getByTestId("place-order-button"));
    expect(document.activeElement).toBe(addressInput);

    // Fix remaining fields -> live summary clears automatically
    fireEvent.change(addressInput, { target: { value: "10 Rue de la Paix" } });
    fireEvent.change(dateInput, { target: { value: "2026-12-01" } });
    fireEvent.change(notesInput, { target: { value: "Ring bell" } });
    expect(liveSummary.textContent).toBe("");
  });

  it("shows per-field errors only after blur, not while typing before first blur, and clears as soon as valid (#351)", () => {
    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="delivery">
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
        />
      </CartProvider>,
    );

    const nameInput = screen.getByTestId("checkout-name-input");
    const phoneInput = screen.getByTestId("checkout-phone-input");
    const addressInput = screen.getByTestId("checkout-address-input");

    // Typing invalid phone before first blur shows NO error
    fireEvent.change(phoneInput, { target: { value: "123" } });
    expect(screen.queryByTestId("checkout-phone-field-error")).toBeNull();
    expect(phoneInput.hasAttribute("aria-invalid")).toBe(false);

    // Blur phone -> shows format error with example, without touching name or address
    fireEvent.blur(phoneInput);
    const phoneErr = screen.getByTestId("checkout-phone-field-error");
    expect(phoneErr.textContent).toBe(dict.phoneInvalidError);
    expect(phoneErr.textContent).toContain("+33 6 12 34 56 78");
    expect(phoneInput.getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByTestId("checkout-name-field-error")).toBeNull();
    expect(screen.queryByTestId("delivery-address-container-error")).toBeNull();

    // Becoming valid clears error immediately
    fireEvent.change(phoneInput, { target: { value: "06 12 34 56 78" } });
    expect(screen.queryByTestId("checkout-phone-field-error")).toBeNull();
    expect(phoneInput.hasAttribute("aria-invalid")).toBe(false);

    // Blur deliveryAddress while name is still empty still surfaces the delivery address error
    fireEvent.change(addressInput, { target: { value: "123" } });
    expect(screen.queryByTestId("delivery-address-container-error")).toBeNull();
    fireEvent.blur(addressInput);
    expect(screen.getByTestId("delivery-address-container-error").textContent).toBe(
      dict.addressRequiredError,
    );
    fireEvent.change(addressInput, { target: { value: "10 Rue de la Paix" } });
    expect(screen.queryByTestId("delivery-address-container-error")).toBeNull();

    // Name too long (>50 chars) shows nameTooLongError on blur
    fireEvent.change(nameInput, { target: { value: "A".repeat(51) } });
    expect(screen.queryByTestId("checkout-name-field-error")).toBeNull();
    fireEvent.blur(nameInput);
    expect(screen.getByTestId("checkout-name-field-error").textContent).toBe(dict.nameTooLongError);
  });

  it("stretches the scheduled radio label across the full card while keeping date/time inputs outside and above it (#351)", () => {
    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
        />
      </CartProvider>,
    );

    const scheduleCard = screen.getByTestId("timing-scheduled-card");
    const scheduleLabel = screen.getByTestId("timing-scheduled-option");
    expect(scheduleCard.className).toContain("relative");
    expect(scheduleLabel.className).toContain("after:absolute");
    expect(scheduleLabel.className).toContain("after:inset-0");

    // Clicking the card's stretched label selects scheduled mode
    fireEvent.click(scheduleLabel);

    const timingInputs = screen.getByTestId("scheduled-timing-inputs");
    expect(timingInputs.className).toContain("relative");
    expect(timingInputs.className).toContain("z-10");

    const dateInput = screen.getByTestId("checkout-date-input") as HTMLInputElement;
    const timeInput = screen.getByTestId("checkout-time-input");

    // Inputs are siblings after the label, never nested inside the radio label
    expect(scheduleLabel.contains(dateInput)).toBe(false);
    expect(scheduleLabel.contains(timeInput)).toBe(false);
    expect(scheduleLabel.querySelectorAll("label").length).toBe(0);

    // Clicking and typing in the date input keeps scheduled mode selected and does not toggle ASAP
    fireEvent.click(dateInput);
    fireEvent.change(dateInput, { target: { value: "2026-12-01" } });
    expect(dateInput.value).toBe("2026-12-01");
    expect(screen.getByTestId("scheduled-timing-inputs")).toBeDefined();

    // Clearing and blurring triggers date validation
    fireEvent.change(dateInput, { target: { value: "" } });
    fireEvent.blur(dateInput);
    expect(screen.getByTestId("checkout-date-field-error").textContent).toBe(
      dict.dateRequiredError,
    );
  });

  it("renders French validation messages and polite summary with zero English Zod literals when locale is fr (#351)", () => {
    const frDict = getDictionary("fr").storefront;

    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="delivery">
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="fr"
          dict={frDict}
        />
      </CartProvider>,
    );

    fireEvent.click(screen.getByTestId("timing-scheduled-option"));
    fireEvent.change(screen.getByTestId("checkout-phone-input"), {
      target: { value: "abc" },
    });
    fireEvent.change(screen.getByTestId("checkout-address-input"), {
      target: { value: "a".repeat(301) },
    });
    fireEvent.change(screen.getByTestId("checkout-notes-input"), {
      target: { value: "n".repeat(501) },
    });

    fireEvent.click(screen.getByTestId("place-order-button"));

    const liveSummary = screen.getByTestId("checkout-validation-summary");
    expect(liveSummary.textContent).toBe(frDict.formValidationSummary);

    const errorTestIds = [
      "checkout-name-field-error",
      "checkout-phone-field-error",
      "delivery-address-container-error",
      "checkout-date-field-error",
      "checkout-notes-field-error",
    ] as const;

    expect(screen.getByTestId("checkout-name-field-error").textContent).toBe(
      frDict.nameRequiredError,
    );
    expect(screen.getByTestId("checkout-phone-field-error").textContent).toBe(
      frDict.phoneInvalidError,
    );
    expect(screen.getByTestId("checkout-phone-field-error").textContent).toContain(
      "+33 6 12 34 56 78",
    );
    expect(screen.getByTestId("delivery-address-container-error").textContent).toBe(
      frDict.addressTooLongError,
    );
    expect(screen.getByTestId("checkout-date-field-error").textContent).toBe(
      frDict.dateRequiredError,
    );
    expect(screen.getByTestId("checkout-notes-field-error").textContent).toBe(
      frDict.notesTooLongError,
    );

    const allErrorText = [
      liveSummary.textContent ?? "",
      ...errorTestIds.map((id) => screen.getByTestId(id).textContent ?? ""),
    ].join(" ");
    expect(allErrorText).not.toMatch(/Please|Invalid|Delivery address|Name must be|Notes must be/);
  });

  it("falls back to generic localized fieldInvalidError for unknown schema issues (#351)", () => {
    expect(mapCheckoutIssueToDictKey({ path: ["unknownField"], code: "custom" }, "")).toBe(
      "fieldInvalidError",
    );
    expect(mapCheckoutIssueToDictKey({ path: ["name"], code: "custom" }, "ab\u0000cd")).toBe(
      "fieldInvalidError",
    );
    expect(mapCheckoutIssueToDictKey({ path: ["requestedDate"], code: "invalid_format" }, "")).toBe(
      "dateInvalidError",
    );
    expect(mapCheckoutIssueToDictKey({ path: ["requestedTime"], code: "invalid_format" }, "")).toBe(
      "timeInvalidError",
    );
    expect(getDictionary("en").storefront.fieldInvalidError).toBe("Please check this field");
    expect(getDictionary("fr").storefront.fieldInvalidError).toBe("Veuillez vérifier ce champ");
  });

  it("saves contact to localStorage and triggers onSubmitOrder on valid submission", async () => {
    const onSubmitOrder = vi.fn();

    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          onSubmitOrder={onSubmitOrder}
        />
      </CartProvider>,
    );

    const nameInput = screen.getByTestId("checkout-name-input");
    fireEvent.change(nameInput, { target: { value: "Lucas Bernard" } });

    const phoneInput = screen.getByTestId("checkout-phone-input");
    fireEvent.change(phoneInput, { target: { value: "+33698765432" } });

    const form = screen.getByTestId("checkout-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(onSubmitOrder).toHaveBeenCalledTimes(1);
    });

    // Check device local storage
    const stored = JSON.parse(localStorage.getItem(GUEST_CONTACT_STORAGE_KEY) || "{}");
    expect(stored.name).toBe("Lucas Bernard");
    expect(stored.phone).toBe("+33698765432");

    // Success confirmation view
    expect(screen.getByTestId("checkout-success-view")).toBeDefined();
  });

  it("prefills notes from Cart and syncs edits back to Cart (#85, #86)", () => {
    render(
      <CartProvider initialItems={mockCartItems} initialNotes="Handle with care">
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
        />
      </CartProvider>,
    );

    const notesInput = screen.getByTestId("checkout-notes-input") as HTMLTextAreaElement;
    expect(notesInput.value).toBe("Handle with care");

    fireEvent.change(notesInput, { target: { value: "Extra napkins please" } });
    expect(notesInput.value).toBe("Extra napkins please");
  });

  it("displays explicit WhatsApp phone label, clean helper text, and no misleading verified badge (#86)", () => {
    render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    // Label contains WhatsApp order updates
    expect(screen.getByText(dict.phone)).toBeDefined();

    // Helper text contains only "No account required."
    expect(screen.getByText(dict.phoneHelper)).toBeDefined();
    expect(screen.queryByText(/Zero database lookups/i)).toBeNull();

    // Static "Verified SMS" badge is completely removed
    expect(screen.queryByText(/SMS validé/i)).toBeNull();
    expect(screen.queryByText(/Verified SMS/i)).toBeNull();
  });

  it("renders concealed anti-spam honeypot input with accessibility guards (#90)", () => {
    render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    const honeypot = screen.getByTestId("checkout-honeypot-input") as HTMLInputElement;
    expect(honeypot).toBeDefined();
    expect(honeypot.getAttribute("tabIndex")).toBe("-1");
    expect(honeypot.getAttribute("autoComplete")).toBe("off");
    expect(honeypot.value).toBe("");
  });

  it("opens persistent confirmation after placing an order", async () => {
    // Mock placeOrderAction resolving with success
    const mockOrderData = {
      orderId: "order-999",
      orderNumber: 42,
      trackingToken: "token-secret-42",
      status: "NEW" as const,
      totalAmount: 690,
    };

    const actionSpy = vi
      .spyOn(await import("../storefront-actions"), "placeOrderAction")
      .mockResolvedValue({
        ok: true,
        data: mockOrderData,
      });

    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    const nameInput = screen.getByTestId("checkout-name-input");
    fireEvent.change(nameInput, { target: { value: "Valérie Trierweiler" } });

    const phoneInput = screen.getByTestId("checkout-phone-input");
    fireEvent.change(phoneInput, { target: { value: "+33611223344" } });

    const form = screen.getByTestId("checkout-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(actionSpy).toHaveBeenCalledTimes(1);
    });

    const callPayload = actionSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(callPayload.name).toBe("Valérie Trierweiler");
    expect(callPayload.phone).toBe("+33611223344");
    expect(callPayload.idempotencyKey).toBeDefined();

    // Verify confirmation view is displayed and empty cart notice never flashes
    expect(screen.getByTestId("checkout-success-view")).toBeDefined();
    expect(screen.getByText(dict.orderPlacedTitle)).toBeDefined();
    expect(screen.getAllByText(dict.redirectingToTracking).length).toBeGreaterThan(0);
    expect(screen.queryByText(dict.emptyCartTitle)).toBeNull();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/en/order/token-secret-42/confirmed");
    });
  });

  it("displays server error feedback when placeOrderAction rejects (#87, #90)", async () => {
    vi.spyOn(await import("../storefront-actions"), "placeOrderAction").mockResolvedValue({
      ok: false,
      code: "RATE_LIMITED",
      reason: "ANTI_ABUSE_REJECTION",
      message: "Too many order attempts. Please wait a few minutes before trying again.",
    });

    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
        <CheckoutView
          isOpen
          isAcceptingOrders
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    const nameInput = screen.getByTestId("checkout-name-input");
    fireEvent.change(nameInput, { target: { value: "Valérie Trierweiler" } });

    const phoneInput = screen.getByTestId("checkout-phone-input");
    fireEvent.change(phoneInput, { target: { value: "+33611223344" } });

    const form = screen.getByTestId("checkout-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId("checkout-error-feedback")).toBeDefined();
    });

    expect(
      screen.getByText("Too many order attempts. Please wait a few minutes before trying again."),
    ).toBeDefined();
  });

  it.each([
    ["en", "VALIDATION", undefined],
    ["en", "RATE_LIMITED", "ANTI_ABUSE_REJECTION"],
    ["en", "CONFLICT", "STORE_CLOSED"],
    ["en", "CONFLICT", "SERVICE_TYPE_DISABLED"],
    ["en", "CONFLICT", "MINIMUM_ORDER_UNMET"],
    ["en", "CONFLICT", "STOCK_ERROR"],
    ["en", "INTERNAL", undefined],
    ["fr", "CONFLICT", "STORE_CLOSED"],
    ["fr", "INTERNAL", undefined],
  ] as const)(
    "announces a localized %s message for %s without showing raw server text",
    async (locale, code, reason) => {
      vi.spyOn(await import("../storefront-actions"), "placeOrderAction").mockResolvedValue({
        ok: false,
        code,
        reason,
        message: "RAW SERVER TEXT permission denied 42501",
      });
      const localDict = getDictionary(locale).storefront;
      const messages: Record<string, string> = {
        VALIDATION: localDict.orderErrorValidation,
        ANTI_ABUSE_REJECTION: localDict.orderErrorAntiAbuse,
        STORE_CLOSED: localDict.orderErrorStoreClosed,
        SERVICE_TYPE_DISABLED: localDict.orderErrorServiceDisabled,
        MINIMUM_ORDER_UNMET: localDict.orderErrorMinimum,
        STOCK_ERROR: localDict.orderErrorStock,
        INTERNAL: localDict.orderErrorInternal,
      };

      render(
        <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
          <CheckoutView
            isOpen
            isAcceptingOrders
            business={mockBusiness}
            settings={mockSettings}
            locale={locale}
            dict={localDict}
            redirectDelayMs={50}
          />
        </CartProvider>,
      );
      fireEvent.change(screen.getByTestId("checkout-name-input"), {
        target: { value: "Valérie Trierweiler" },
      });
      fireEvent.change(screen.getByTestId("checkout-phone-input"), {
        target: { value: "+33611223344" },
      });
      fireEvent.submit(screen.getByTestId("checkout-form"));

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe(messages[reason ?? code]);
      expect(alert.textContent).not.toContain("RAW SERVER TEXT");
    },
  );

  it("has a localized message in every language for every place-order error code", () => {
    for (const locale of ["en", "fr"] as const) {
      const d = getDictionary(locale).storefront;
      for (const key of [
        d.orderErrorValidation,
        d.orderErrorAntiAbuse,
        d.orderErrorStoreClosed,
        d.orderErrorServiceDisabled,
        d.orderErrorMinimum,
        d.orderErrorStock,
        d.orderErrorInternal,
      ]) {
        expect(key.length).toBeGreaterThan(0);
      }
    }
    expect(getDictionary("fr").storefront.orderErrorStock).not.toBe(
      getDictionary("en").storefront.orderErrorStock,
    );
  });

  it("hides ASAP, preselects Schedule for later, shows closed notice, and requires a date when closed but accepting orders (#350)", async () => {
    const onSubmitOrder = vi.fn();

    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
        <CheckoutView
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          isOpen={false}
          isAcceptingOrders={true}
          onSubmitOrder={onSubmitOrder}
        />
      </CartProvider>,
    );

    // ASAP option is hidden, Schedule for later is preselected with inputs visible
    expect(screen.queryByTestId("timing-asap-option")).toBeNull();
    expect(screen.getByTestId("timing-scheduled-option")).toBeDefined();
    expect(screen.getByTestId("scheduled-timing-inputs")).toBeDefined();

    // Notice explains the order will be prepared for the chosen slot
    const notice = screen.getByTestId("checkout-closed-schedule-notice");
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.textContent).toBe(dict.checkoutClosedScheduleNotice);

    // Fill contact details, omit date, submit -> blocked with localized dateRequiredError (#351)
    fireEvent.change(screen.getByTestId("checkout-name-input"), {
      target: { value: "Léa Martin" },
    });
    fireEvent.change(screen.getByTestId("checkout-phone-input"), {
      target: { value: "+33612345678" },
    });
    fireEvent.click(screen.getByTestId("place-order-button"));

    expect(onSubmitOrder).not.toHaveBeenCalled();
    const dateError = screen.getByTestId("checkout-date-field-error");
    expect(dateError.textContent).toBe(dict.dateRequiredError);
    expect(document.activeElement).toBe(screen.getByTestId("checkout-date-input"));

    // Picking a date allows submitting a scheduled order
    fireEvent.change(screen.getByTestId("checkout-date-input"), {
      target: { value: "2026-12-01" },
    });
    expect(screen.queryByTestId("checkout-date-field-error")).toBeNull();

    fireEvent.submit(screen.getByTestId("checkout-form"));
    await waitFor(() => {
      expect(onSubmitOrder).toHaveBeenCalledTimes(1);
    });
    expect(onSubmitOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        isAsap: false,
        requestedDate: "2026-12-01",
      }),
    );
  });

  it("renders French closed-store scheduling notice and date error when locale is fr (#350)", () => {
    const frDict = getDictionary("fr").storefront;

    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
        <CheckoutView
          business={mockBusiness}
          settings={mockSettings}
          locale="fr"
          dict={frDict}
          isOpen={false}
          isAcceptingOrders={true}
        />
      </CartProvider>,
    );

    expect(screen.queryByTestId("timing-asap-option")).toBeNull();
    expect(screen.getByTestId("checkout-closed-schedule-notice").textContent).toBe(
      frDict.checkoutClosedScheduleNotice,
    );

    fireEvent.change(screen.getByTestId("checkout-name-input"), {
      target: { value: "Léa Martin" },
    });
    fireEvent.change(screen.getByTestId("checkout-phone-input"), {
      target: { value: "+33612345678" },
    });
    fireEvent.click(screen.getByTestId("place-order-button"));

    expect(screen.getByTestId("checkout-date-field-error").textContent).toBe(
      frDict.dateRequiredError,
    );
  });

  it("keeps ASAP default and hides closed notice when store is open or not accepting orders (#350)", () => {
    const { unmount } = render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
        <CheckoutView
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          isOpen={true}
          isAcceptingOrders={true}
        />
      </CartProvider>,
    );

    expect(screen.getByTestId("timing-asap-option")).toBeDefined();
    expect(screen.queryByTestId("scheduled-timing-inputs")).toBeNull();
    expect(screen.queryByTestId("checkout-closed-schedule-notice")).toBeNull();
    unmount();

    // When not accepting orders, preserve existing checkout behaviour (server rejects with STORE_CLOSED)
    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
        <CheckoutView
          business={mockBusiness}
          settings={{ ...mockSettings, acceptingOrders: false }}
          locale="en"
          dict={dict}
          isOpen={false}
          isAcceptingOrders={false}
        />
      </CartProvider>,
    );

    expect(screen.getByTestId("timing-asap-option")).toBeDefined();
    expect(screen.queryByTestId("checkout-closed-schedule-notice")).toBeNull();
  });

  describe("pay-on-handover options and badges (#377)", () => {
    const renderWithPayments = (
      paymentMethods: BusinessSettings["paymentMethods"],
      locale: "en" | "fr" = "en",
    ) =>
      render(
        <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
          <CheckoutView
            isOpen
            isAcceptingOrders
            business={mockBusiness}
            settings={{ ...mockSettings, paymentMethods }}
            locale={locale}
            dict={getDictionary(locale).storefront}
          />
        </CartProvider>,
      );

    it("shows Cash on handover and only the Cash badge when only cash is enabled", () => {
      renderWithPayments({ cash: true, card: false, revolut: true, wero: true });

      const handover = screen.getByTestId("payment-on-handover");
      expect(handover.textContent).toContain("Cash on handover");
      expect(screen.getByTestId("payment-badge-cash")).toBeDefined();
      expect(screen.queryByTestId("payment-badge-card")).toBeNull();
      expect(screen.getByTestId("payment-revolut").textContent).toContain("Revolut (Revtag)");
    });

    it("shows Card on handover and only the Contactless badge when only card is enabled", () => {
      renderWithPayments({ cash: false, card: true, revolut: true, wero: true });

      const handover = screen.getByTestId("payment-on-handover");
      expect(handover.textContent).toContain("Card on handover");
      expect(handover.textContent).toContain("Pay by card when you receive your order");
      expect(screen.queryByTestId("payment-badge-cash")).toBeNull();
      expect(screen.getByTestId("payment-badge-card").textContent).toContain("Contactless");
      const radio = handover.querySelector('input[type="radio"]') as HTMLInputElement;
      expect(radio.checked).toBe(true);
    });

    it("shows Cash or card on handover and both badges when cash and card are enabled", () => {
      renderWithPayments({ cash: true, card: true, revolut: true, wero: true });

      const handover = screen.getByTestId("payment-on-handover");
      expect(handover.textContent).toContain("Cash or card on handover");
      expect(handover.textContent).toContain("Pay in cash or by card when you receive your order");
      expect(screen.getByTestId("payment-badge-cash")).toBeDefined();
      expect(screen.getByTestId("payment-badge-card")).toBeDefined();
    });

    it("hides pay-on-handover when neither cash nor card is enabled and falls back to revolut", () => {
      renderWithPayments({ cash: false, card: false, revolut: true, wero: true });

      expect(screen.queryByTestId("payment-on-handover")).toBeNull();
      const revolutRadio = screen
        .getByTestId("payment-revolut")
        .querySelector('input[type="radio"]') as HTMLInputElement;
      expect(revolutRadio.checked).toBe(true);
    });
  });
});
