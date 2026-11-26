import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/domain/i18n";
import { CartProvider, resetCartStore, SERVICE_MODE_STORAGE_KEY } from "../context/cart-context";
import { CheckoutView } from "../components/checkout-view";
import { resetGuestContactCache } from "../components/checkout-form";
import { GUEST_CONTACT_STORAGE_KEY } from "@/domain/checkout";
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
    resetCartStore();
    resetGuestContactCache();
    localStorage.clear();
  });

  afterEach(() => {
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
        <CheckoutView business={mockBusiness} settings={mockSettings} locale="en" dict={dict} />
      </CartProvider>,
    );

    expect(screen.getByText(dict.emptyCartTitle)).toBeDefined();
    expect(screen.queryByTestId("checkout-form")).toBeNull();
  });

  it("keeps the place-order bar in the page flow above the footer (#237)", () => {
    render(
      <CartProvider initialItems={mockCartItems}>
        <CheckoutView business={mockBusiness} settings={mockSettings} locale="en" dict={dict} />
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
        <CheckoutView business={mockBusiness} settings={mockSettings} locale="en" dict={dict} />
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
    // #234: neutral pay-on-handover copy and compact Wero badge
    expect(screen.getByText("Pay in cash or by card when you receive your order")).toBeDefined();
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

  it("gates Place Order button until valid name and phone are entered", () => {
    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
        <CheckoutView
          business={mockBusiness}
          settings={mockSettings}
          locale="en"
          dict={dict}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    const submitBtn = screen.getByTestId("place-order-button") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    // Fill invalid name
    const nameInput = screen.getByTestId("checkout-name-input");
    fireEvent.change(nameInput, { target: { value: "A" } }); // too short
    expect(submitBtn.disabled).toBe(true);

    // Fill valid name
    fireEvent.change(nameInput, { target: { value: "Léa Martin" } });
    expect(submitBtn.disabled).toBe(true); // phone still missing

    // Fill valid phone
    const phoneInput = screen.getByTestId("checkout-phone-input");
    fireEvent.change(phoneInput, { target: { value: "+33612345678" } });

    expect(submitBtn.disabled).toBe(false);
  });

  it("saves contact to localStorage and triggers onSubmitOrder on valid submission", async () => {
    const onSubmitOrder = vi.fn();

    render(
      <CartProvider initialItems={mockCartItems} initialServiceMode="pickup">
        <CheckoutView
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
        <CheckoutView business={mockBusiness} settings={mockSettings} locale="en" dict={dict} />
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
});
