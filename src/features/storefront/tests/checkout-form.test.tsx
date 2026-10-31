import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/domain/i18n";
import { CartProvider, resetCartStore } from "../context/cart-context";
import { CheckoutView } from "../components/checkout-view";
import { resetGuestContactCache } from "../components/checkout-form";
import { GUEST_CONTACT_STORAGE_KEY } from "@/domain/checkout";
import type { Business, BusinessSettings } from "@/domain/business";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  usePathname: () => "/en/checkout",
}));

const dict = getDictionary("en").storefront;

const mockBusiness: Business = {
  id: "biz-1",
  name: "La Petite Boulangerie",
  slug: "la-petite-boulangerie",
  description: "Artisanal Parisian bakery",
  phone: "+33 1 23 45 67 89",
  email: "contact@petiteboulangerie.fr",
  whatsappNumber: "33123456789",
  address: "12 Rue de la Paix, 75002 Paris",
  currency: "EUR",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
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
  revolutRevtag: "petiteboulangerie",
  weroIdentifier: "wero@petiteboulangerie.fr",
  paymentMethods: {
    cash: true,
    revolut: true,
    wero: true,
  },
  paymentInstructionsEn: "Please settle payment upon collection.",
  paymentInstructionsFr: "Règlement au comptoir.",
  inAppAlerts: true,
  soundAlerts: true,
};

const mockCartItems = [
  {
    productId: "p1",
    name: "Pain au Chocolat",
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
    cleanup();
    resetCartStore();
    resetGuestContactCache();
    localStorage.clear();
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

  it("shows delivery address field when Local Delivery is selected", () => {
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

    // Default pickup
    expect(screen.queryByTestId("delivery-address-container")).toBeNull();

    // Select delivery
    const deliveryBtn = screen.getByTestId("service-delivery-button");
    fireEvent.click(deliveryBtn);

    expect(screen.getByTestId("delivery-address-container")).toBeDefined();
    expect(screen.getByTestId("checkout-address-input")).toBeDefined();
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

    // Default ASAP
    expect(screen.queryByTestId("scheduled-timing-inputs")).toBeNull();

    // Select Schedule Later
    const scheduleOption = screen.getByTestId("timing-scheduled-option");
    fireEvent.click(scheduleOption);

    expect(screen.getByTestId("scheduled-timing-inputs")).toBeDefined();
    expect(screen.getByTestId("checkout-date-input")).toBeDefined();
  });

  it("gates Place Order button until valid name and phone are entered", () => {
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
      <CartProvider initialItems={mockCartItems}>
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
        success: true,
        data: mockOrderData,
      });

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
      success: false,
      error: "Too many order attempts. Please wait a few minutes before trying again.",
      code: "ANTI_ABUSE_REJECTION",
    });

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
});
