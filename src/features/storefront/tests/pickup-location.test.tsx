import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessSettings } from "@/domain/business";
import { getDictionary } from "@/domain/i18n";
import type { WeeklyHours } from "@/domain/opening-hours";
import type { StorefrontPickupLocation } from "@/domain/pickup-location";
import type { StorefrontBusiness } from "@/domain/storefront-business";
import { ToastProvider } from "@/components/ui";
import { DEMO_PRODUCT, demoBusiness } from "@/lib/repositories/mock/fixtures";
import { CartProvider, PICKUP_LOCATION_STORAGE_KEY, resetCartStore } from "../context/cart-context";
import { CartView } from "../components/cart-view";
import { CheckoutView } from "../components/checkout-view";
import { resetGuestContactCache } from "../components/checkout-form";
import { PickupLocationPicker } from "../components/pickup-location-picker";
import { ServiceToggleHeader } from "../components/service-toggle-header";
import {
  formatCompactWeeklyHours,
  formatPickupFee,
  isPickupChoiceValid,
  resolvePickupState,
  SHOP_PICKUP_VALUE,
} from "../pickup-options";
import { storefrontPricing } from "../storefront-pricing";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  usePathname: () => "/en/checkout",
}));

const enDict = getDictionary("en").storefront;
const frDict = getDictionary("fr").storefront;

const business: StorefrontBusiness = {
  name: demoBusiness.name,
  description: demoBusiness.description,
  phone: demoBusiness.phone,
  email: demoBusiness.email,
  whatsappNumber: demoBusiness.whatsappNumber,
  address: demoBusiness.address,
};

const RELAY_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const RELAY_B_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const RELAY_C_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const RELAY_D_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";

const morningRange = [{ open: "09:00", close: "12:00" }];
const afternoonRange = [{ open: "15:00", close: "18:00" }];
const fullDayRange = [{ open: "09:00", close: "19:00" }];

// Business: Mon & Sun closed; Tue-Sat 09:00-19:00; closed holiday on 2026-12-01.
const businessWeeklyHours: WeeklyHours = {
  mon: [],
  tue: fullDayRange,
  wed: fullDayRange,
  thu: fullDayRange,
  fri: fullDayRange,
  sat: fullDayRange,
  sun: [],
};

// Relay A: afternoon-only on Thu & Fri + Mon (Mon must be masked by business closure!).
const relayAWeeklyHours: WeeklyHours = {
  mon: afternoonRange,
  tue: [],
  wed: [],
  thu: afternoonRange,
  fri: afternoonRange,
  sat: morningRange,
  sun: [],
};

const relayA: StorefrontPickupLocation = {
  id: RELAY_A_ID,
  name: "Gare RER B",
  description: "Outside North exit",
  address: "Place de la gare",
  postcode: "93210",
  feeCents: 150,
  weeklyHours: relayAWeeklyHours,
  sortOrder: 0,
};

const relayB: StorefrontPickupLocation = {
  id: RELAY_B_ID,
  name: "Gare RER D",
  description: null,
  address: "Rue de la République",
  postcode: "93200",
  feeCents: 0,
  weeklyHours: null,
  sortOrder: 1,
};

const relayC: StorefrontPickupLocation = {
  id: RELAY_C_ID,
  name: "Marché Central",
  description: "Near fountain",
  address: "10 Place du Marché",
  postcode: "75012",
  feeCents: 200,
  weeklyHours: null,
  sortOrder: 2,
};

const relayD: StorefrontPickupLocation = {
  id: RELAY_D_ID,
  name: "Métro Nation",
  description: "Exit 4",
  address: "Place de la Nation",
  postcode: "75011",
  feeCents: 250,
  weeklyHours: null,
  sortOrder: 3,
};

const baseSettings: BusinessSettings = {
  businessId: "biz-1",
  currency: "EUR",
  dateFormat: "DD/MM/YYYY",
  lowStockThreshold: 5,
  taxPercentage: 10,
  notifications: true,
  acceptingOrders: true,
  serviceTypes: { pickup: true, delivery: true, dineIn: false },
  openingHours: "09:00 - 19:00",
  weeklyHours: businessWeeklyHours,
  hoursExceptions: [
    { from: "2026-12-01", to: "2026-12-01", ranges: [], note: "Holiday" },
    {
      from: "2026-11-30",
      to: "2026-11-30",
      ranges: [{ open: "10:00", close: "12:00" }],
      note: "Special Monday",
    },
  ],
  shopPickupEnabled: true,
  orderTimingAsap: true,
  orderTimingScheduled: true,
  orderTimingTimeOptional: true,
  deliveryFee: 250,
  minOrderAmount: 0,
  leadTimeValue: 30,
  leadTimeUnit: "minutes",
  revolutRevtag: "saveurscontinent",
  weroIdentifier: "wero@example.com",
  paymentMethods: { cash: true, card: false, revolut: true, wero: true },
  paymentInstructionsEn: "",
  paymentInstructionsFr: "",
  inAppAlerts: true,
  soundAlerts: true,
  timezone: "Europe/Paris",
};

const cartItems = [
  {
    productId: "11111111-1111-4111-8111-111111111199",
    name: DEMO_PRODUCT.pouletBraise.name,
    price: 1000,
    quantity: 2,
    maxStock: 5,
    imageUrl: null,
  },
];

// Thu 2026-11-26 10:00Z = 11:00 Europe/Paris (business open 09:00-19:00; relayA closed until 15:00)
const THU_11_00_PARIS = "2026-11-26T10:00:00Z";

const optionValues = (select: HTMLElement) =>
  within(select)
    .getAllByRole("option")
    .map((option) => (option as HTMLOptionElement).value)
    .filter(Boolean);

function fillCheckoutContact() {
  fireEvent.change(screen.getByTestId("checkout-name-input"), { target: { value: "Léa Martin" } });
  fireEvent.change(screen.getByTestId("checkout-phone-input"), {
    target: { value: "+33612345678" },
  });
}

describe("pickup-options helpers (#386)", () => {
  it("resolves 0, 1, and multiple pickup options accurately", () => {
    expect(resolvePickupState(null, false, [])).toMatchObject({
      optionCount: 0,
      unavailable: true,
      isSingleOption: false,
      requiresChoice: false,
      selectedChoice: null,
      selectedRelay: null,
    });

    expect(resolvePickupState(null, true, [])).toMatchObject({
      optionCount: 1,
      unavailable: false,
      isSingleOption: true,
      requiresChoice: false,
      selectedChoice: SHOP_PICKUP_VALUE,
      selectedRelay: null,
    });

    expect(resolvePickupState(null, false, [relayA])).toMatchObject({
      optionCount: 1,
      unavailable: false,
      isSingleOption: true,
      requiresChoice: false,
      selectedChoice: RELAY_A_ID,
      selectedRelay: relayA,
      hasPaidOption: true,
    });

    expect(resolvePickupState(null, true, [relayA])).toMatchObject({
      optionCount: 2,
      unavailable: false,
      isSingleOption: false,
      requiresChoice: true,
      selectedChoice: null,
      selectedRelay: null,
    });

    expect(resolvePickupState(RELAY_A_ID, true, [relayA])).toMatchObject({
      requiresChoice: false,
      selectedChoice: RELAY_A_ID,
      selectedRelay: relayA,
    });

    expect(isPickupChoiceValid("stale-id", true, [relayA])).toBe(false);
    expect(isPickupChoiceValid(SHOP_PICKUP_VALUE, false, [relayA])).toBe(false);
    expect(isPickupChoiceValid(SHOP_PICKUP_VALUE, true, [relayA])).toBe(true);
  });

  it("formats fees and compact weekly hours in EN and FR", () => {
    expect(formatPickupFee(0, "en", enDict.pickupLocationFeeFree)).toBe("Free");
    expect(formatPickupFee(150, "en", enDict.pickupLocationFeeFree)).toBe("+€1.50");
    expect(formatPickupFee(0, "fr", frDict.pickupLocationFeeFree)).toBe("Gratuit");
    expect(formatPickupFee(150, "fr", frDict.pickupLocationFeeFree)).toMatch(/^\+1,50\s€$/);

    const allClosed: WeeklyHours = {
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    };
    expect(formatCompactWeeklyHours(allClosed, "en", enDict.storeClosedBadge)).toBe("Closed");
    expect(formatCompactWeeklyHours(relayAWeeklyHours, "en", enDict.storeClosedBadge)).toContain(
      "15:00–18:00",
    );
  });

  it("computes storefront pricing cleanly and returns ok: false on invalid inputs without fallback totals", () => {
    expect(
      storefrontPricing({
        items: cartItems,
        serviceType: "pickup",
        deliveryFee: 250,
        pickupFee: 150,
      }),
    ).toEqual({
      ok: true,
      subtotal: 2000,
      deliveryFee: 0,
      pickupFee: 150,
      total: 2150,
    });

    expect(
      storefrontPricing({
        items: cartItems,
        serviceType: "delivery",
        deliveryFee: 250,
        pickupFee: 150,
      }),
    ).toEqual({
      ok: true,
      subtotal: 2000,
      deliveryFee: 250,
      pickupFee: 0,
      total: 2250,
    });

    expect(
      storefrontPricing({
        items: [{ ...cartItems[0], price: -10 }],
        serviceType: "pickup",
      }),
    ).toMatchObject({ ok: false });

    expect(
      storefrontPricing({
        items: [{ ...cartItems[0], quantity: 1.5 }],
        serviceType: "pickup",
      }),
    ).toMatchObject({ ok: false });

    expect(
      storefrontPricing({
        items: cartItems,
        serviceType: "delivery",
        deliveryFee: -50,
      }),
    ).toEqual({ ok: false, reason: "INVALID_DELIVERY_FEE" });

    expect(
      storefrontPricing({
        items: cartItems,
        serviceType: "pickup",
        pickupFee: Number.NaN,
      }),
    ).toEqual({ ok: false, reason: "INVALID_PICKUP_FEE" });
  });
});

describe("PickupLocationPicker component (#386)", () => {
  it("renders a single shop option as preselected read-only group with aria-labelledby (no radios)", () => {
    render(
      <PickupLocationPicker
        shopPickupEnabled={true}
        pickupLocations={[]}
        businessName={business.name}
        businessAddress={business.address}
        businessSchedule={{ weekly: businessWeeklyHours, exceptions: [] }}
        selectedChoice={SHOP_PICKUP_VALUE}
        onSelect={vi.fn()}
        locale="en"
        dict={enDict}
      />,
    );

    const group = screen.getByRole("group", { name: enDict.pickupLocationSectionTitle });
    expect(group.getAttribute("data-testid")).toBe("pickup-location-picker");
    const card = screen.getByTestId("pickup-location-readonly");
    expect(card.textContent).toContain(business.name);
    expect(card.textContent).toContain(business.address);
    expect(card.textContent).toContain("Free");
    expect(card.textContent).toContain("09:00–19:00");
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("scopes the unavailable notice testid from the picker data-testid", () => {
    const { rerender } = render(
      <PickupLocationPicker
        shopPickupEnabled={false}
        pickupLocations={[]}
        businessSchedule={{ weekly: businessWeeklyHours, exceptions: [] }}
        selectedChoice={null}
        onSelect={vi.fn()}
        locale="en"
        dict={enDict}
      />,
    );
    expect(screen.getByTestId("pickup-location-picker-unavailable")).toBeDefined();

    rerender(
      <PickupLocationPicker
        shopPickupEnabled={false}
        pickupLocations={[]}
        businessSchedule={{ weekly: businessWeeklyHours, exceptions: [] }}
        selectedChoice={null}
        onSelect={vi.fn()}
        locale="en"
        dict={enDict}
        data-testid="custom-picker"
      />,
    );
    expect(screen.getByTestId("custom-picker-unavailable")).toBeDefined();
  });

  it("hides shop when shopPickupEnabled is false and renders lone relay read-only", () => {
    render(
      <PickupLocationPicker
        shopPickupEnabled={false}
        pickupLocations={[relayA]}
        businessName={business.name}
        businessAddress={business.address}
        businessSchedule={{ weekly: businessWeeklyHours, exceptions: [] }}
        selectedChoice={RELAY_A_ID}
        onSelect={vi.fn()}
        locale="en"
        dict={enDict}
      />,
    );

    const card = screen.getByTestId("pickup-location-readonly");
    expect(card.textContent).not.toContain(business.name);
    expect(card.textContent).toContain("Gare RER B");
    expect(card.textContent).toContain("Outside North exit");
    expect(card.textContent).toContain("Place de la gare, 93210");
    expect(card.textContent).toContain("+€1.50");
    // Mon hours on relayA are masked because business is closed on Monday.
    expect(screen.getByTestId(`pickup-option-hours-${RELAY_A_ID}`).textContent).not.toMatch(/Mon/i);
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("shows Same as shop hours for relays without own weeklyHours and translates to French", () => {
    render(
      <PickupLocationPicker
        shopPickupEnabled={true}
        pickupLocations={[relayA, relayB]}
        businessName={business.name}
        businessAddress={business.address}
        businessSchedule={{ weekly: businessWeeklyHours, exceptions: [] }}
        selectedChoice={null}
        onSelect={vi.fn()}
        locale="fr"
        dict={frDict}
      />,
    );

    expect(screen.getByTestId(`pickup-option-hours-${RELAY_B_ID}`).textContent).toBe(
      frDict.pickupLocationSameAsShopHours,
    );
    expect(screen.getByTestId(`pickup-option-fee-${SHOP_PICKUP_VALUE}`).textContent).toBe(
      "Gratuit",
    );
    expect(screen.getByTestId(`pickup-option-fee-${RELAY_A_ID}`).textContent).toMatch(
      /^\+1,50\s€$/,
    );
    // Radio cards satisfy the >= 44px touch target rule (min-h-11).
    expect(screen.getByTestId(`pickup-location-option-${RELAY_A_ID}`).className).toContain(
      "min-h-11",
    );
  });

  it("collapses options past 3 behind Show all and auto-expands when the 4th option is selected", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <PickupLocationPicker
        shopPickupEnabled={true}
        pickupLocations={[relayA, relayB, relayC, relayD]}
        businessName={business.name}
        businessAddress={business.address}
        businessSchedule={{ weekly: businessWeeklyHours, exceptions: [] }}
        selectedChoice={null}
        onSelect={onSelect}
        locale="en"
        dict={enDict}
      />,
    );

    // 5 options total -> first 3 shown (shop, relayA, relayB) + Show all (5)
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.queryByTestId(`pickup-location-option-${RELAY_C_ID}`)).toBeNull();
    const toggle = screen.getByTestId("pickup-locations-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("Show all (5)");
    expect(toggle.className).toContain("min-h-9");

    fireEvent.click(toggle);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toContain("Show fewer");

    fireEvent.click(toggle);
    expect(screen.getAllByRole("radio")).toHaveLength(3);

    // Fresh render with the 5th option preselected auto-expands so it is visible.
    rerender(
      <PickupLocationPicker
        key="preselected-4th"
        shopPickupEnabled={true}
        pickupLocations={[relayA, relayB, relayC, relayD]}
        businessName={business.name}
        businessAddress={business.address}
        businessSchedule={{ weekly: businessWeeklyHours, exceptions: [] }}
        selectedChoice={RELAY_D_ID}
        onSelect={onSelect}
        locale="en"
        dict={enDict}
      />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(
      (screen.getByTestId(`pickup-location-radio-${RELAY_D_ID}`) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("renders min-w-0 on fieldset, wrap-anywhere on long option text, and links inline error via aria-describedby", async () => {
    const { container } = render(
      <main>
        <h1>Checkout</h1>
        <PickupLocationPicker
          shopPickupEnabled={true}
          pickupLocations={[relayA, relayB, relayC, relayD]}
          businessName={business.name}
          businessAddress={business.address}
          businessSchedule={{ weekly: businessWeeklyHours, exceptions: [] }}
          selectedChoice={null}
          onSelect={vi.fn()}
          locale="en"
          dict={enDict}
          showRequiredPrompt
          error={enDict.orderErrorPickupLocationInvalid}
        />
      </main>,
    );

    const fieldset = screen.getByTestId("pickup-location-picker");
    expect(fieldset.className).toContain("min-w-0");
    const alert = within(fieldset).getByTestId("pickup-location-picker-error");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toBe(enDict.orderErrorPickupLocationInvalid);
    expect(fieldset.getAttribute("aria-describedby")).toBe(alert.id);

    const firstRadio = screen.getByTestId(`pickup-location-radio-${SHOP_PICKUP_VALUE}`);
    expect(firstRadio.getAttribute("aria-describedby")).toBe(alert.id);
    expect(screen.getByTestId(`pickup-location-option-${RELAY_A_ID}`).innerHTML).toContain(
      "wrap-anywhere",
    );

    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("passes axe-core WCAG 2.2 AA checks in read-only single-option group mode with error", async () => {
    const { container } = render(
      <main>
        <h1>Checkout</h1>
        <PickupLocationPicker
          shopPickupEnabled={true}
          pickupLocations={[]}
          businessName={business.name}
          businessAddress={business.address}
          businessSchedule={{ weekly: businessWeeklyHours, exceptions: [] }}
          selectedChoice={SHOP_PICKUP_VALUE}
          onSelect={vi.fn()}
          locale="en"
          dict={enDict}
          error={enDict.orderErrorPickupNotAvailable}
        />
      </main>,
    );

    const group = screen.getByRole("group", { name: enDict.pickupLocationSectionTitle });
    const alert = within(group).getByTestId("pickup-location-picker-error");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(group.getAttribute("aria-describedby")).toBe(alert.id);

    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});

describe("Storefront pickup location integration (#386)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(THU_11_00_PARIS));
    resetCartStore();
    resetGuestContactCache();
    localStorage.clear();
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetCartStore();
    resetGuestContactCache();
    localStorage.clear();
  });

  it("lets the customer choose a relay in OrderingDetailsDialog, persists it, and updates status + CartView total", async () => {
    const { unmount } = render(
      <ToastProvider>
        <CartProvider initialItems={cartItems} initialServiceMode="pickup">
          <ServiceToggleHeader
            isAcceptingOrders
            isOpen
            businessName={business.name}
            businessAddress={business.address}
            shopPickupEnabled={true}
            pickupLocations={[relayA, relayB]}
            settings={baseSettings}
            locale="en"
            dict={enDict}
          />
        </CartProvider>
      </ToastProvider>,
    );

    // Before picking: left tile prompts to choose among 3 options, shop is Open at 11:00.
    expect(screen.getByTestId("service-info-tile").textContent).toContain(
      enDict.pickupLocationChooseTile,
    );
    expect(screen.getByTestId("service-info-tile").textContent).toContain("3 locations");
    expect(screen.getByTestId("store-status-tile").textContent).toContain(enDict.storeOpenBadge);

    fireEvent.click(screen.getByTestId("service-info-tile"));
    const dialog = await screen.findByTestId("ordering-details-dialog");
    expect(within(dialog).getByTestId("ordering-details-pickup-picker")).toBeDefined();

    // Pick Relay A (+€1.50, opens at 15:00 on Thursday)
    fireEvent.click(within(dialog).getByTestId(`pickup-location-radio-${RELAY_A_ID}`));
    expect(localStorage.getItem(PICKUP_LOCATION_STORAGE_KEY)).toBe(RELAY_A_ID);

    // Header tiles immediately show relay name + fee and relay's closed status until 15:00
    expect(screen.getByTestId("service-info-tile").textContent).toContain("+€1.50 pickup fee");
    expect(screen.getByTestId("service-info-tile").textContent).toContain("Gare RER B");
    expect(screen.getByTestId("store-status-tile").textContent).toContain(enDict.storeClosedBadge);
    expect(screen.getByTestId("store-status-tile").textContent).toContain("15:00");

    unmount();

    // Navigating to CartView picks up the persisted relay choice and includes €1.50 in total (2000 + 150 = €21.50)
    render(
      <ToastProvider>
        <CartProvider initialItems={cartItems} initialServiceMode="pickup">
          <CartView
            locale="en"
            dict={enDict}
            settings={baseSettings}
            shopPickupEnabled={true}
            pickupLocations={[relayA, relayB]}
          />
        </CartProvider>
      </ToastProvider>,
    );

    expect(screen.getByTestId("cart-subtotal-value").textContent).toBe("€18.00");
    expect(screen.getByTestId("cart-tax-value").textContent).toBe("€2.00");
    expect(screen.getByText(enDict.cartIncludedVat)).toBeDefined();
    expect(screen.getByTestId("cart-fee-row").textContent).toContain("Gare RER B");
    expect(screen.getByTestId("cart-fee-value").textContent).toBe("€1.50");
    expect(screen.getByTestId("cart-order-total").textContent).toBe("€21.50");
    expect(screen.getByTestId("proceed-checkout-button").textContent).toContain("€21.50");
  });

  it("requires a pickup choice before Place order when several options exist (#351 pattern) and updates fee in total", () => {
    render(
      <CartProvider initialItems={cartItems} initialServiceMode="pickup">
        <CheckoutView
          business={business}
          settings={baseSettings}
          shopPickupEnabled={true}
          pickupLocations={[relayA, relayB]}
          locale="en"
          dict={enDict}
          isOpen
          isAcceptingOrders
          nowIso={THU_11_00_PARIS}
        />
      </CartProvider>,
    );

    const submitBtn = screen.getByTestId("place-order-button") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    const reason = screen.getByTestId("checkout-blocked-reason");
    expect(reason.textContent).toBe(enDict.orderErrorPickupLocationRequired);
    expect(submitBtn.getAttribute("aria-describedby")).toBe(
      screen.getByTestId("checkout-blocked-reason-region").id,
    );
    expect(screen.getByTestId("checkout-fee-value").textContent).toBe(
      enDict.pickupLocationFeePending,
    );
    expect(screen.getByTestId("checkout-order-total").textContent).toBe("€20.00");

    // Pick paid Relay A -> Place order enabled, fee €1.50 added to total (€21.50)
    fireEvent.click(screen.getByTestId(`pickup-location-radio-${RELAY_A_ID}`));
    expect(submitBtn.disabled).toBe(false);
    expect(screen.queryByTestId("checkout-blocked-reason")).toBeNull();
    expect(screen.getByTestId("checkout-fee-value").textContent).toBe("€1.50");
    expect(screen.getByTestId("checkout-order-total").textContent).toBe("€21.50");
    expect(submitBtn.textContent).toContain("€21.50");

    // Pick Shop -> fee Free, total €20.00
    fireEvent.click(screen.getByTestId(`pickup-location-radio-${SHOP_PICKUP_VALUE}`));
    expect(screen.getByTestId("checkout-fee-value").textContent).toBe("Free");
    expect(screen.getByTestId("checkout-order-total").textContent).toBe("€20.00");
    expect(submitBtn.textContent).toContain("€20.00");

    // Switch to Delivery -> delivery fee €2.50, total €22.50
    fireEvent.click(screen.getByTestId("service-delivery-button"));
    expect(screen.getByTestId("checkout-fee-value").textContent).toBe("€2.50");
    expect(screen.getByTestId("checkout-order-total").textContent).toBe("€22.50");
  });

  it("hides the shop row when shopPickupEnabled is false and blocks when 0 pickup options exist", () => {
    const { rerender } = render(
      <CartProvider initialItems={cartItems} initialServiceMode="pickup">
        <CheckoutView
          business={business}
          settings={{ ...baseSettings, shopPickupEnabled: false }}
          shopPickupEnabled={false}
          pickupLocations={[relayA, relayB]}
          locale="en"
          dict={enDict}
          isOpen
          isAcceptingOrders
          nowIso={THU_11_00_PARIS}
        />
      </CartProvider>,
    );

    expect(screen.queryByTestId(`pickup-location-option-${SHOP_PICKUP_VALUE}`)).toBeNull();
    expect(screen.getByTestId(`pickup-location-option-${RELAY_A_ID}`)).toBeDefined();
    expect(screen.getByTestId(`pickup-location-option-${RELAY_B_ID}`)).toBeDefined();

    rerender(
      <CartProvider initialItems={cartItems} initialServiceMode="pickup">
        <CheckoutView
          business={business}
          settings={{ ...baseSettings, shopPickupEnabled: false }}
          shopPickupEnabled={false}
          pickupLocations={[]}
          locale="en"
          dict={enDict}
          isOpen
          isAcceptingOrders
          nowIso={THU_11_00_PARIS}
        />
      </CartProvider>,
    );

    expect(screen.getByTestId("checkout-pickup-picker-unavailable")).toBeDefined();
    expect((screen.getByTestId("place-order-button") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("checkout-blocked-reason").textContent).toBe(
      enDict.orderErrorPickupNotAvailable,
    );
  });

  it("drives checkout dates, times, and ASAP open/closed notice from pickupScheduleFor when a relay is chosen", () => {
    render(
      <CartProvider initialItems={cartItems} initialServiceMode="pickup">
        <CheckoutView
          business={business}
          settings={baseSettings}
          shopPickupEnabled={true}
          pickupLocations={[relayA]}
          locale="en"
          dict={enDict}
          isOpen
          isAcceptingOrders
          nowIso={THU_11_00_PARIS}
        />
      </CartProvider>,
    );

    // Choose Shop: open at 11:00 -> ASAP visible, no closed notice
    fireEvent.click(screen.getByTestId(`pickup-location-radio-${SHOP_PICKUP_VALUE}`));
    expect(screen.getByTestId("timing-asap-option")).toBeDefined();
    expect(screen.queryByTestId("checkout-closed-schedule-notice")).toBeNull();

    // Check Shop scheduled dates include Tue 2026-12-08 & special Mon 2026-11-30
    fireEvent.click(screen.getByTestId("timing-scheduled-option"));
    const shopDates = optionValues(screen.getByTestId("checkout-date-input"));
    expect(shopDates).toContain("2026-11-30"); // special business Monday
    expect(shopDates).toContain("2026-12-02"); // Wed open for shop
    expect(shopDates).not.toContain("2026-12-01"); // business holiday

    // Pick Wed 2026-12-02 (valid for shop, closed for Relay A)
    fireEvent.change(screen.getByTestId("checkout-date-input"), {
      target: { value: "2026-12-02" },
    });
    expect((screen.getByTestId("checkout-date-input") as HTMLSelectElement).value).toBe(
      "2026-12-02",
    );

    // Switch to Relay A (open Thu/Fri 15:00-18:00, Sat 09:00-12:00; closed at 11:00 Thu)
    fireEvent.click(screen.getByTestId(`pickup-location-radio-${RELAY_A_ID}`));

    // ASAP hidden, relay closed notice points to Today at 15:00
    expect(screen.queryByTestId("timing-asap-option")).toBeNull();
    const closedNotice = screen.getByTestId("checkout-closed-schedule-notice");
    expect(closedNotice.textContent).toContain("Today at 15:00");
    expect(closedNotice.textContent).toContain("pickup location");

    // Previous shop-only date was cleared; only Relay A open dates (intersected with business closures) remain
    expect((screen.getByTestId("checkout-date-input") as HTMLSelectElement).value).toBe("");
    const relayDates = optionValues(screen.getByTestId("checkout-date-input"));
    expect(relayDates).toContain("2026-11-26"); // Thu afternoon
    expect(relayDates).toContain("2026-11-27"); // Fri afternoon
    expect(relayDates).toContain("2026-11-28"); // Sat morning
    expect(relayDates).not.toContain("2026-11-30"); // Mon closed for business (special hours don't apply to relay)
    expect(relayDates).not.toContain("2026-12-01"); // Holiday closure applies to relay
    expect(relayDates).not.toContain("2026-12-02"); // Wed closed for relay

    // Thu slots start at 15:00 and end at 17:45
    fireEvent.change(screen.getByTestId("checkout-date-input"), {
      target: { value: "2026-11-26" },
    });
    const thuTimes = optionValues(screen.getByTestId("checkout-time-input"));
    expect(thuTimes[0]).toBe("15:00");
    expect(thuTimes[thuTimes.length - 1]).toBe("17:45");
    expect(thuTimes).not.toContain("11:30");

    // Switching to Delivery restores business schedule (ASAP back, Wed back)
    fireEvent.click(screen.getByTestId("service-delivery-button"));
    expect(screen.getByTestId("timing-asap-option")).toBeDefined();
    expect(screen.queryByTestId("checkout-closed-schedule-notice")).toBeNull();
  });

  it("clears the persisted pickup choice when the location disappears from the catalog", () => {
    const { rerender } = render(
      <CartProvider initialItems={cartItems} initialServiceMode="pickup">
        <CheckoutView
          business={business}
          settings={baseSettings}
          shopPickupEnabled={true}
          pickupLocations={[relayA, relayB]}
          locale="en"
          dict={enDict}
          isOpen
          isAcceptingOrders
          nowIso={THU_11_00_PARIS}
        />
      </CartProvider>,
    );

    fireEvent.click(screen.getByTestId(`pickup-location-radio-${RELAY_A_ID}`));
    expect(localStorage.getItem(PICKUP_LOCATION_STORAGE_KEY)).toBe(RELAY_A_ID);
    expect((screen.getByTestId("place-order-button") as HTMLButtonElement).disabled).toBe(false);

    // Relay A disappears from catalog (leaving Shop + Relay B)
    rerender(
      <CartProvider initialItems={cartItems} initialServiceMode="pickup">
        <CheckoutView
          business={business}
          settings={baseSettings}
          shopPickupEnabled={true}
          pickupLocations={[relayB]}
          locale="en"
          dict={enDict}
          isOpen
          isAcceptingOrders
          nowIso={THU_11_00_PARIS}
        />
      </CartProvider>,
    );

    expect(localStorage.getItem(PICKUP_LOCATION_STORAGE_KEY)).toBeNull();
    expect((screen.getByTestId("place-order-button") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("checkout-blocked-reason").textContent).toBe(
      enDict.orderErrorPickupLocationRequired,
    );
  });

  it("clears a persisted shop choice when shopPickupEnabled turns off and sends null pickupLocationId for delivery", async () => {
    const actionSpy = vi
      .spyOn(await import("../storefront-actions"), "placeOrderAction")
      .mockResolvedValue({
        ok: true,
        data: {
          orderId: "order-delivery-1",
          orderNumber: 79,
          trackingToken: "tok-79",
          status: "NEW",
          totalAmount: 2250,
        },
      });

    localStorage.setItem(PICKUP_LOCATION_STORAGE_KEY, SHOP_PICKUP_VALUE);

    render(
      <CartProvider initialItems={cartItems} initialServiceMode="pickup">
        <CheckoutView
          business={business}
          settings={{ ...baseSettings, shopPickupEnabled: false }}
          shopPickupEnabled={false}
          pickupLocations={[relayA, relayB]}
          locale="en"
          dict={enDict}
          isOpen
          isAcceptingOrders
          nowIso={THU_11_00_PARIS}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    // Persisted "shop" is invalid when shop pickup is disabled -> cleared and Place order disabled
    expect(localStorage.getItem(PICKUP_LOCATION_STORAGE_KEY)).toBeNull();
    expect((screen.getByTestId("place-order-button") as HTMLButtonElement).disabled).toBe(true);

    // Pick Relay A, then switch to Delivery -> delivery must send pickupLocationId: null
    fireEvent.click(screen.getByTestId(`pickup-location-radio-${RELAY_A_ID}`));
    expect(localStorage.getItem(PICKUP_LOCATION_STORAGE_KEY)).toBe(RELAY_A_ID);

    fireEvent.click(screen.getByTestId("service-delivery-button"));
    fillCheckoutContact();
    fireEvent.change(screen.getByTestId("checkout-address-input"), {
      target: { value: "10 Rue de la Paix, Paris" },
    });
    fireEvent.submit(screen.getByTestId("checkout-form"));
    await waitFor(() => expect(actionSpy).toHaveBeenCalledTimes(1));
    const deliveryPayload = actionSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(deliveryPayload.serviceType).toBe("delivery");
    expect(deliveryPayload.pickupLocationId).toBeNull();
  });

  it("sends explicit pickupLocationId (including lone relay) and keeps the same input on retry", async () => {
    const actionSpy = vi
      .spyOn(await import("../storefront-actions"), "placeOrderAction")
      .mockResolvedValueOnce({
        ok: false,
        code: "INTERNAL",
        message: "transient network error",
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          orderId: "order-relay-1",
          orderNumber: 77,
          trackingToken: "tok-77",
          status: "NEW",
          totalAmount: 2150,
        },
      });

    // Lone relay (shop pickup off): preselected read-only, must still send its id explicitly!
    render(
      <CartProvider initialItems={cartItems} initialServiceMode="pickup">
        <CheckoutView
          business={business}
          settings={{ ...baseSettings, shopPickupEnabled: false }}
          shopPickupEnabled={false}
          pickupLocations={[{ ...relayA, weeklyHours: null }]}
          locale="en"
          dict={enDict}
          isOpen
          isAcceptingOrders
          nowIso={THU_11_00_PARIS}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    expect(screen.getByTestId("pickup-location-readonly")).toBeDefined();
    expect(screen.getByTestId("checkout-order-total").textContent).toBe("€21.50");

    fillCheckoutContact();
    fireEvent.submit(screen.getByTestId("checkout-form"));
    await screen.findByTestId("checkout-error-feedback");
    await waitFor(() =>
      expect((screen.getByTestId("place-order-button") as HTMLButtonElement).disabled).toBe(false),
    );

    // Retry the same order after transient failure -> identical idempotencyKey & pickupLocationId
    fireEvent.submit(screen.getByTestId("checkout-form"));
    await waitFor(() => expect(actionSpy).toHaveBeenCalledTimes(2));

    const firstPayload = actionSpy.mock.calls[0][0] as Record<string, unknown>;
    const secondPayload = actionSpy.mock.calls[1][0] as Record<string, unknown>;
    expect(firstPayload.pickupLocationId).toBe(RELAY_A_ID);
    expect(secondPayload.pickupLocationId).toBe(RELAY_A_ID);
    expect(secondPayload.idempotencyKey).toBe(firstPayload.idempotencyKey);
    expect(secondPayload).toEqual(firstPayload);
  });

  it("sends pickupLocationId: null when the shop is explicitly chosen", async () => {
    const actionSpy = vi
      .spyOn(await import("../storefront-actions"), "placeOrderAction")
      .mockResolvedValue({
        ok: true,
        data: {
          orderId: "order-shop-1",
          orderNumber: 78,
          trackingToken: "tok-78",
          status: "NEW",
          totalAmount: 2000,
        },
      });

    render(
      <CartProvider initialItems={cartItems} initialServiceMode="pickup">
        <CheckoutView
          business={business}
          settings={baseSettings}
          shopPickupEnabled={true}
          pickupLocations={[relayA]}
          locale="en"
          dict={enDict}
          isOpen
          isAcceptingOrders
          nowIso={THU_11_00_PARIS}
          redirectDelayMs={50}
        />
      </CartProvider>,
    );

    fireEvent.click(screen.getByTestId(`pickup-location-radio-${SHOP_PICKUP_VALUE}`));
    fillCheckoutContact();
    fireEvent.submit(screen.getByTestId("checkout-form"));
    await waitFor(() => expect(actionSpy).toHaveBeenCalledTimes(1));
    const shopPayload = actionSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(shopPayload.pickupLocationId).toBeNull();
  });

  it.each([
    ["en", "PICKUP_LOCATION_INVALID", enDict.orderErrorPickupLocationInvalid],
    ["en", "PICKUP_LOCATION_REQUIRED", enDict.orderErrorPickupLocationRequired],
    ["en", "PICKUP_NOT_AVAILABLE", enDict.orderErrorPickupNotAvailable],
    ["fr", "PICKUP_LOCATION_INVALID", frDict.orderErrorPickupLocationInvalid],
    ["fr", "PICKUP_LOCATION_REQUIRED", frDict.orderErrorPickupLocationRequired],
    ["fr", "PICKUP_NOT_AVAILABLE", frDict.orderErrorPickupNotAvailable],
  ] as const)(
    "displays localized %s inline server error for %s inside the picker without exposing raw server text",
    async (locale, reason, expectedMessage) => {
      vi.spyOn(await import("../storefront-actions"), "placeOrderAction").mockResolvedValue({
        ok: false,
        code: "CONFLICT",
        reason,
        message: "RAW_PG_DETAIL pickup_locations_pkey",
      });

      const localDict = getDictionary(locale).storefront;
      render(
        <CartProvider initialItems={cartItems} initialServiceMode="pickup">
          <CheckoutView
            business={business}
            settings={baseSettings}
            shopPickupEnabled={true}
            pickupLocations={[]}
            locale={locale}
            dict={localDict}
            isOpen
            isAcceptingOrders
            nowIso={THU_11_00_PARIS}
            redirectDelayMs={50}
          />
        </CartProvider>,
      );

      fillCheckoutContact();
      fireEvent.submit(screen.getByTestId("checkout-form"));

      const picker = screen.getByTestId("checkout-pickup-picker");
      const alert = await within(picker).findByTestId("checkout-pickup-picker-error");
      expect(alert.getAttribute("role")).toBe("alert");
      expect(alert.textContent).toBe(expectedMessage);
      expect(alert.textContent).not.toContain("RAW_PG_DETAIL");
      expect(picker.getAttribute("aria-describedby")).toBe(alert.id);
      expect(screen.queryByTestId("checkout-error-feedback")).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(picker));
    },
  );

  it.each(["PICKUP_LOCATION_INVALID", "PICKUP_LOCATION_REQUIRED"] as const)(
    "clears stored choice, focuses the picker radios, and blocks re-sending a stale relay on %s",
    async (reason) => {
      vi.spyOn(await import("../storefront-actions"), "placeOrderAction").mockResolvedValue({
        ok: false,
        code: "CONFLICT",
        reason,
        message: "stale relay",
      });

      render(
        <CartProvider initialItems={cartItems} initialServiceMode="pickup">
          <CheckoutView
            business={business}
            settings={baseSettings}
            shopPickupEnabled={true}
            pickupLocations={[{ ...relayA, weeklyHours: null }, relayB]}
            locale="en"
            dict={enDict}
            isOpen
            isAcceptingOrders
            nowIso={THU_11_00_PARIS}
            redirectDelayMs={50}
          />
        </CartProvider>,
      );

      // Select Relay A and submit
      fireEvent.click(screen.getByTestId(`pickup-location-radio-${RELAY_A_ID}`));
      expect(localStorage.getItem(PICKUP_LOCATION_STORAGE_KEY)).toBe(RELAY_A_ID);
      fillCheckoutContact();
      fireEvent.submit(screen.getByTestId("checkout-form"));

      const picker = screen.getByTestId("checkout-pickup-picker");
      const alert = await within(picker).findByTestId("checkout-pickup-picker-error");
      expect(alert.getAttribute("role")).toBe("alert");
      expect(picker.getAttribute("aria-describedby")).toBe(alert.id);
      expect(screen.queryByTestId("checkout-error-feedback")).toBeNull();

      // Stored choice cleared so the stale relay cannot be re-sent
      expect(localStorage.getItem(PICKUP_LOCATION_STORAGE_KEY)).toBeNull();
      expect((screen.getByTestId("place-order-button") as HTMLButtonElement).disabled).toBe(true);

      // Focus moved to the first radio inside the picker
      const firstRadio = screen.getByTestId(`pickup-location-radio-${SHOP_PICKUP_VALUE}`);
      await waitFor(() => expect(document.activeElement).toBe(firstRadio));

      // Picking another location clears the error and re-enables ordering
      fireEvent.click(firstRadio);
      expect(screen.queryByTestId("checkout-pickup-picker-error")).toBeNull();
      expect((screen.getByTestId("place-order-button") as HTMLButtonElement).disabled).toBe(false);
    },
  );

  it("formats single paid relay pickup toggle label via localized i18n template in EN and FR", () => {
    const { rerender } = render(
      <CartProvider initialItems={cartItems} initialServiceMode="pickup">
        <CheckoutView
          business={business}
          settings={{ ...baseSettings, shopPickupEnabled: false }}
          shopPickupEnabled={false}
          pickupLocations={[{ ...relayA, weeklyHours: null }]}
          locale="en"
          dict={enDict}
          isOpen
          isAcceptingOrders
          nowIso={THU_11_00_PARIS}
        />
      </CartProvider>,
    );

    expect(screen.getByTestId("service-pickup-button").textContent).toContain("Pickup (€1.50)");

    rerender(
      <CartProvider initialItems={cartItems} initialServiceMode="pickup">
        <CheckoutView
          business={business}
          settings={{ ...baseSettings, shopPickupEnabled: false }}
          shopPickupEnabled={false}
          pickupLocations={[{ ...relayA, weeklyHours: null }]}
          locale="fr"
          dict={frDict}
          isOpen
          isAcceptingOrders
          nowIso={THU_11_00_PARIS}
        />
      </CartProvider>,
    );

    expect(screen.getByTestId("service-pickup-button").textContent).toMatch(/Retrait \(1,50\s€\)/);
  });

  it("blocks checkout with a visible reason and logs when storefront pricing fails", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const corruptedItems = [{ ...cartItems[0], price: -100 }];

    render(
      <CartProvider initialItems={corruptedItems} initialServiceMode="pickup">
        <CheckoutView
          business={business}
          settings={baseSettings}
          shopPickupEnabled={true}
          pickupLocations={[]}
          locale="en"
          dict={enDict}
          isOpen
          isAcceptingOrders
          nowIso={THU_11_00_PARIS}
        />
      </CartProvider>,
    );

    const alert = screen.getByTestId("checkout-pricing-error");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toBe(enDict.pricingUnavailableError);
    expect(screen.queryByTestId("checkout-order-total")).toBeNull();

    const submitBtn = screen.getByTestId("place-order-button") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toBe(enDict.placeOrder);
    expect(screen.getByTestId("checkout-blocked-reason").textContent).toBe(
      enDict.pricingUnavailableError,
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain("storefront_pricing_failed");
    errorSpy.mockRestore();
  });
});
