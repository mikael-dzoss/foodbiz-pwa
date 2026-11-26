import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceToggleHeader } from "../components/service-toggle-header";
import { CartProvider, resetCartStore, SERVICE_MODE_STORAGE_KEY } from "../context/cart-context";
import { ToastProvider } from "@/components/ui";
import { enDictionary, frDictionary } from "@/domain/i18n";

describe("ServiceToggleHeader (#193)", () => {
  beforeEach(() => {
    resetCartStore();
    localStorage.clear();
  });

  afterEach(() => {
    resetCartStore();
    localStorage.clear();
  });

  it("defaults to Delivery when delivery is enabled, renders fee + min order tile and Open status tile", () => {
    render(
      <ToastProvider>
        <CartProvider>
          <ServiceToggleHeader
            isAcceptingOrders={true}
            isOpen={true}
            openingHoursText="07:30 - 19:30"
            businessAddress="12 Rue de la Roquette, 75011 Paris"
            settings={{
              serviceTypes: { pickup: true, delivery: true, dineIn: true },
              deliveryFee: 250,
              minOrderAmount: 1000,
              orderTimingScheduled: true,
            }}
            locale="en"
            dict={enDictionary.storefront}
          />
        </CartProvider>
      </ToastProvider>,
    );

    const deliveryRadio = screen.getByTestId("service-mode-delivery");
    const pickupRadio = screen.getByTestId("service-mode-pickup");
    expect(deliveryRadio.getAttribute("aria-checked")).toBe("true");
    expect(pickupRadio.getAttribute("aria-checked")).toBe("false");

    expect(screen.getByTestId("readiness-badge").textContent).toContain("Ready in ~1 business day");

    const infoTile = screen.getByTestId("service-info-tile");
    expect(infoTile.textContent).toMatch(/€2\.50 delivery fee|2,50\s*€/);
    expect(infoTile.textContent).toMatch(/Min order €10\.00/);

    const statusTile = screen.getByTestId("store-status-tile");
    expect(statusTile.textContent).toContain(enDictionary.storefront.storeOpenBadge);
    expect(statusTile.textContent).toMatch(/Closes at 19:30/);
  });

  it("shows Free delivery and omits min order line when deliveryFee and minOrderAmount are 0", () => {
    render(
      <ToastProvider>
        <CartProvider>
          <ServiceToggleHeader
            isAcceptingOrders={true}
            isOpen={true}
            settings={{
              serviceTypes: { pickup: true, delivery: true, dineIn: false },
              deliveryFee: 0,
              minOrderAmount: 0,
              orderTimingScheduled: true,
            }}
            locale="en"
            dict={enDictionary.storefront}
          />
        </CartProvider>
      </ToastProvider>,
    );

    const infoTile = screen.getByTestId("service-info-tile");
    expect(infoTile.textContent).toContain(enDictionary.storefront.freeDelivery);
    expect(infoTile.textContent).not.toMatch(/Min order/i);
  });

  it("switches to Pickup via click and keyboard arrows, persists in localStorage, and shows No fees + address", () => {
    render(
      <ToastProvider>
        <CartProvider>
          <ServiceToggleHeader
            isAcceptingOrders={true}
            isOpen={true}
            businessAddress="12 Rue de la Roquette, 75011 Paris"
            settings={{
              serviceTypes: { pickup: true, delivery: true, dineIn: true },
              deliveryFee: 250,
              minOrderAmount: 1000,
              orderTimingScheduled: true,
            }}
            locale="en"
            dict={enDictionary.storefront}
          />
        </CartProvider>
      </ToastProvider>,
    );

    const deliveryRadio = screen.getByTestId("service-mode-delivery");
    const pickupRadio = screen.getByTestId("service-mode-pickup");

    fireEvent.click(pickupRadio);
    expect(pickupRadio.getAttribute("aria-checked")).toBe("true");
    expect(localStorage.getItem(SERVICE_MODE_STORAGE_KEY)).toBe("pickup");

    const infoTile = screen.getByTestId("service-info-tile");
    expect(infoTile.textContent).toContain(enDictionary.storefront.noFees);
    expect(infoTile.textContent).toContain("12 Rue de la Roquette, 75011 Paris");

    // Keyboard arrow back to Delivery
    fireEvent.keyDown(pickupRadio, { key: "ArrowLeft" });
    expect(deliveryRadio.getAttribute("aria-checked")).toBe("true");
    expect(localStorage.getItem(SERVICE_MODE_STORAGE_KEY)).toBe("delivery");

    // Keyboard ArrowRight to Pickup
    fireEvent.keyDown(deliveryRadio, { key: "ArrowRight" });
    expect(pickupRadio.getAttribute("aria-checked")).toBe("true");
    expect(localStorage.getItem(SERVICE_MODE_STORAGE_KEY)).toBe("pickup");
  });

  it("defaults to Pickup when delivery is disabled and shows toast when activating disabled Delivery", () => {
    render(
      <ToastProvider>
        <CartProvider>
          <ServiceToggleHeader
            isAcceptingOrders={true}
            isOpen={true}
            businessAddress="12 Rue de la Roquette, 75011 Paris"
            settings={{
              serviceTypes: { pickup: true, delivery: false, dineIn: true },
              deliveryFee: 250,
              minOrderAmount: 1000,
              orderTimingScheduled: true,
            }}
            locale="en"
            dict={enDictionary.storefront}
          />
        </CartProvider>
      </ToastProvider>,
    );

    const deliveryRadio = screen.getByTestId("service-mode-delivery");
    const pickupRadio = screen.getByTestId("service-mode-pickup");

    expect(pickupRadio.getAttribute("aria-checked")).toBe("true");
    expect(deliveryRadio.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(deliveryRadio);
    expect(pickupRadio.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(enDictionary.storefront.deliveryUnavailableToast)).toBeDefined();
  });

  it("keeps disabled Pickup visible and focusable with aria-disabled and shows toast on click", () => {
    render(
      <ToastProvider>
        <CartProvider>
          <ServiceToggleHeader
            isAcceptingOrders={true}
            isOpen={true}
            settings={{
              serviceTypes: { pickup: false, delivery: true, dineIn: false },
              deliveryFee: 250,
              minOrderAmount: 0,
              orderTimingScheduled: true,
            }}
            locale="fr"
            dict={frDictionary.storefront}
          />
        </CartProvider>
      </ToastProvider>,
    );

    const pickupRadio = screen.getByTestId("service-mode-pickup");
    expect(pickupRadio.getAttribute("aria-disabled")).toBe("true");
    expect(pickupRadio.hasAttribute("disabled")).toBe(false);

    fireEvent.click(pickupRadio);
    expect(screen.getByText(frDictionary.storefront.pickupUnavailableToast)).toBeDefined();
  });

  it("renders Closed status with opening time and scheduled-order messaging when store is closed", () => {
    render(
      <ToastProvider>
        <CartProvider>
          <ServiceToggleHeader
            isAcceptingOrders={true}
            isOpen={false}
            orderTimingScheduled={true}
            openingHoursText="08:00 - 18:00"
            locale="en"
            dict={enDictionary.storefront}
          />
        </CartProvider>
      </ToastProvider>,
    );

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.storeClosedBadge)).toBeDefined();
    expect(screen.getByText(/Opens at 08:00/)).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.storeClosedBanner)).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.scheduledOnlyNotice)).toBeDefined();
  });

  it("renders role='alert' and Not accepting orders when isAcceptingOrders is false", () => {
    render(
      <ToastProvider>
        <CartProvider>
          <ServiceToggleHeader
            isAcceptingOrders={false}
            isOpen={false}
            openingHoursText="08:00 - 18:00"
            locale="en"
            dict={enDictionary.storefront}
          />
        </CartProvider>
      </ToastProvider>,
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.notAcceptingOrdersShort)).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.notAcceptingOrdersBanner)).toBeDefined();
  });

  it("shows the manager lead time in the readiness badge (#226)", () => {
    render(
      <ToastProvider>
        <CartProvider>
          <ServiceToggleHeader
            isAcceptingOrders
            isOpen
            settings={{
              serviceTypes: { pickup: true, delivery: true, dineIn: false },
              deliveryFee: 0,
              minOrderAmount: 0,
              orderTimingScheduled: true,
              leadTimeValue: 20,
              leadTimeUnit: "minutes",
            }}
            locale="fr"
            dict={frDictionary.storefront}
          />
        </CartProvider>
      </ToastProvider>,
    );
    expect(screen.getByTestId("readiness-badge").textContent).toContain("Prêt en ~20 min");
  });

  it("opens the ordering details card from the badge and tiles and closes on Escape (#227)", async () => {
    render(
      <ToastProvider>
        <CartProvider>
          <ServiceToggleHeader
            isAcceptingOrders
            isOpen
            openingHoursText="07:30 - 19:30"
            businessAddress="12 Rue de la Roquette"
            settings={{
              serviceTypes: { pickup: true, delivery: true, dineIn: false },
              deliveryFee: 350,
              minOrderAmount: 0,
              orderTimingScheduled: true,
              leadTimeValue: 1,
              leadTimeUnit: "business_days",
            }}
            locale="en"
            dict={enDictionary.storefront}
          />
        </CartProvider>
      </ToastProvider>,
    );

    fireEvent.click(screen.getByTestId("readiness-badge"));
    const dialog = await screen.findByTestId("ordering-details-dialog");
    expect(dialog.textContent).toContain("€3.50");
    expect(dialog.textContent).toContain(enDictionary.storefront.detailsNoMinimum);
    expect(dialog.textContent).toContain("07:30 - 19:30");
    expect(dialog.textContent).toContain("~1 business day");
    expect(screen.getByTestId("ordering-details-status").textContent).toContain("Closes at 19:30");
    expect(screen.queryByTestId("ordering-details-note")).toBeNull();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("ordering-details-dialog")).toBeNull());

    fireEvent.click(screen.getByTestId("service-mode-pickup"));
    fireEvent.click(screen.getByTestId("service-info-tile"));
    const pickupDialog = await screen.findByTestId("ordering-details-dialog");
    expect(pickupDialog.textContent).toContain("12 Rue de la Roquette");
    expect(pickupDialog.textContent).not.toContain(enDictionary.storefront.detailsDeliveryFee);
  });

  it("shows closed and paused status in the details card (#227)", async () => {
    const { rerender } = render(
      <ToastProvider>
        <CartProvider>
          <ServiceToggleHeader
            isAcceptingOrders
            isOpen={false}
            openingHoursText="07:30 - 19:30"
            settings={{
              serviceTypes: { pickup: true, delivery: true, dineIn: false },
              deliveryFee: 0,
              minOrderAmount: 1500,
              orderTimingScheduled: true,
            }}
            locale="en"
            dict={enDictionary.storefront}
          />
        </CartProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByTestId("store-status-tile"));
    const dialog = await screen.findByTestId("ordering-details-dialog");
    expect(dialog.textContent).toContain(enDictionary.storefront.freeDelivery);
    expect(dialog.textContent).toContain("€15.00");
    expect(screen.getByTestId("ordering-details-status").textContent).toContain("Opens at 07:30");

    rerender(
      <ToastProvider>
        <CartProvider>
          <ServiceToggleHeader
            isAcceptingOrders={false}
            isOpen={false}
            settings={null}
            locale="en"
            dict={enDictionary.storefront}
          />
        </CartProvider>
      </ToastProvider>,
    );
    expect(screen.getByTestId("ordering-details-status").textContent).toBe(
      enDictionary.storefront.notAcceptingOrdersShort,
    );
  });

  describe("structured hours (#372)", () => {
    const range = [{ open: "11:30", close: "14:30" }];
    const weeklyHours = {
      mon: [],
      tue: range,
      wed: range,
      thu: range,
      fri: range,
      sat: range,
      sun: [],
    };
    const baseSettings = {
      serviceTypes: { pickup: true, delivery: true, dineIn: true },
      deliveryFee: 0,
      minOrderAmount: 0,
      orderTimingScheduled: true,
      timezone: "Europe/Paris",
      weeklyHours,
      hoursExceptions: [],
    };

    function renderHeader(isOpen: boolean) {
      render(
        <ToastProvider>
          <CartProvider>
            <ServiceToggleHeader
              isAcceptingOrders={true}
              isOpen={isOpen}
              openingHoursText="07:30 - 19:30"
              settings={baseSettings}
              locale="en"
              dict={enDictionary.storefront}
            />
          </CartProvider>
        </ToastProvider>,
      );
    }

    it("derives open state and closing time from structured hours, ignoring the cached flag", () => {
      vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
      vi.setSystemTime(new Date("2026-12-01T11:00:00Z")); // Tue 12:00 Paris
      try {
        renderHeader(false);
        const tile = screen.getByTestId("store-status-tile");
        expect(tile.textContent).toContain(enDictionary.storefront.storeOpenBadge);
        expect(tile.textContent).toContain("14:30");
        expect(tile.textContent).toContain("Closes at 14:30");
      } finally {
        vi.useRealTimers();
      }
    });

    it("shows the next opening day when closed", () => {
      vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
      vi.setSystemTime(new Date("2026-11-30T11:00:00Z")); // Mon, closed all day
      try {
        renderHeader(true);
        const tile = screen.getByTestId("store-status-tile");
        expect(tile.textContent).toContain(enDictionary.storefront.storeClosedBadge);
        expect(tile.textContent).toContain("Opens Tue 11:30");
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
