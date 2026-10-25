import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/domain/i18n";
import { CartProvider, resetCartStore } from "../context/cart-context";
import { CheckoutView } from "../components/checkout-view";
import { resetGuestContactCache } from "../components/checkout-form";
import { GUEST_CONTACT_STORAGE_KEY } from "@/domain/checkout";
import type { Business, BusinessSettings } from "@/domain/business";

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
        <CheckoutView business={mockBusiness} settings={mockSettings} locale="en" dict={dict} />
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
        <CheckoutView business={mockBusiness} settings={mockSettings} locale="en" dict={dict} />
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
        <CheckoutView business={mockBusiness} settings={mockSettings} locale="en" dict={dict} />
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
        <CheckoutView business={mockBusiness} settings={mockSettings} locale="en" dict={dict} />
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
        <CheckoutView business={mockBusiness} settings={mockSettings} locale="en" dict={dict} />
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
        <CheckoutView business={mockBusiness} settings={mockSettings} locale="en" dict={dict} />
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
});
