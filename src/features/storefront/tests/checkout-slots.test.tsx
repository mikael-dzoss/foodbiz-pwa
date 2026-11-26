import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/domain/i18n";
import type { BusinessSettings } from "@/domain/business";
import type { WeeklyHours } from "@/domain/opening-hours";
import { DEMO_PRODUCT, demoBusiness } from "@/lib/repositories/mock/fixtures";
import { CartProvider, resetCartStore } from "../context/cart-context";
import { CheckoutView } from "../components/checkout-view";
import { resetGuestContactCache } from "../components/checkout-form";
import type { StorefrontBusiness } from "@/domain/storefront-business";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/en/checkout",
}));

const dict = getDictionary("en").storefront;

const business: StorefrontBusiness = {
  name: demoBusiness.name,
  description: demoBusiness.description,
  phone: demoBusiness.phone,
  email: demoBusiness.email,
  whatsappNumber: demoBusiness.whatsappNumber,
  address: demoBusiness.address,
};

const lunchOnly = [{ open: "11:30", close: "14:00" }];
const split = [
  { open: "09:00", close: "12:00" },
  { open: "14:00", close: "18:00" },
];
// Thu 2026-11-26 is the reference day; Sun/Mon closed.
const weeklyHours: WeeklyHours = {
  mon: [],
  tue: lunchOnly,
  wed: lunchOnly,
  thu: split,
  fri: lunchOnly,
  sat: lunchOnly,
  sun: [],
};

const settings: BusinessSettings = {
  businessId: "biz-1",
  currency: "EUR",
  dateFormat: "DD/MM/YYYY",
  lowStockThreshold: 5,
  taxPercentage: 10,
  notifications: true,
  acceptingOrders: true,
  serviceTypes: { pickup: true, delivery: false, dineIn: false },
  openingHours: "",
  orderTimingAsap: true,
  orderTimingScheduled: true,
  orderTimingTimeOptional: true,
  deliveryFee: 0,
  minOrderAmount: 0,
  leadTimeValue: 1,
  leadTimeUnit: "business_days",
  revolutRevtag: "tag",
  weroIdentifier: "wero@example.com",
  paymentMethods: { cash: true, card: false, revolut: true, wero: true },
  paymentInstructionsEn: "",
  paymentInstructionsFr: "",
  inAppAlerts: true,
  soundAlerts: true,
  timezone: "Europe/Paris",
  weeklyHours,
  hoursExceptions: [
    {
      from: "2026-11-30",
      to: "2026-11-30",
      ranges: [{ open: "10:00", close: "12:00" }],
      note: "Market day",
    },
    { from: "2026-12-01", to: "2026-12-01", ranges: [], note: "Holiday" },
  ],
};

const cart = [
  {
    productId: "p1",
    name: DEMO_PRODUCT.pouletBraise.name,
    price: 220,
    quantity: 2,
    maxStock: 5,
    imageUrl: null,
  },
];

// Paris is UTC+1 in November: 10:00Z = 11:00 (open), 11:30Z = 12:30 (closed between ranges),
// 20:00Z = 21:00 (closed for the day).
const OPEN_NOW = "2026-11-26T10:00:00Z";
const BETWEEN_NOW = "2026-11-26T11:30:00Z";
const CLOSED_NOW = "2026-11-26T20:00:00Z";

function renderCheckout(
  nowIso: string,
  props: { isOpen?: boolean; isAcceptingOrders?: boolean; settings?: BusinessSettings } = {},
) {
  return render(
    <CartProvider initialItems={cart} initialServiceMode="pickup">
      <CheckoutView
        business={business}
        settings={props.settings ?? settings}
        locale="en"
        dict={dict}
        isOpen={props.isOpen ?? true}
        isAcceptingOrders={props.isAcceptingOrders ?? true}
        nowIso={nowIso}
      />
    </CartProvider>,
  );
}

const optionValues = (select: HTMLElement) =>
  within(select)
    .getAllByRole("option")
    .map((o) => (o as HTMLOptionElement).value)
    .filter(Boolean);

function fillContact() {
  fireEvent.change(screen.getByTestId("checkout-name-input"), { target: { value: "Léa Martin" } });
  fireEvent.change(screen.getByTestId("checkout-phone-input"), {
    target: { value: "+33612345678" },
  });
}

describe("checkout slot options (#373, #374)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  function atNow(nowIso: string) {
    vi.setSystemTime(new Date(nowIso));
  }

  it("offers opening days only, applies exceptions, and caps the window at today + 30", () => {
    atNow(OPEN_NOW);
    renderCheckout(OPEN_NOW);
    fireEvent.click(screen.getByTestId("timing-scheduled-option"));

    const dates = optionValues(screen.getByTestId("checkout-date-input"));
    expect(dates[0]).toBe("2026-11-26");
    expect(dates[dates.length - 1]).toBe("2026-12-26");
    expect(dates).toContain("2026-11-27");
    expect(dates).not.toContain("2026-11-29"); // Sunday, closed
    expect(dates).toContain("2026-11-30"); // Monday with special hours
    expect(dates).not.toContain("2026-12-01"); // closed holiday exception
    expect(dates).toContain("2026-12-02");

    const labels = within(screen.getByTestId("checkout-date-input"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels[1]).toContain(dict.today);
    expect(labels[2]).toContain(dict.checkoutDateTomorrow);
  });

  it("lists the 15-minute slots of the chosen day and hides past slots today", () => {
    atNow(OPEN_NOW);
    renderCheckout(OPEN_NOW);
    fireEvent.click(screen.getByTestId("timing-scheduled-option"));

    fireEvent.change(screen.getByTestId("checkout-date-input"), {
      target: { value: "2026-11-26" },
    });
    const today = optionValues(screen.getByTestId("checkout-time-input"));
    expect(today[0]).toBe("11:15");
    expect(today).not.toContain("09:00");
    expect(today).not.toContain("11:00");
    expect(today).toContain("14:00");
    expect(today).toContain("17:45");
    expect(today).not.toContain("18:00");

    fireEvent.change(screen.getByTestId("checkout-date-input"), {
      target: { value: "2026-11-27" },
    });
    expect(optionValues(screen.getByTestId("checkout-time-input"))).toEqual([
      "11:30",
      "11:45",
      "12:00",
      "12:15",
      "12:30",
      "12:45",
      "13:00",
      "13:15",
      "13:30",
      "13:45",
    ]);
  });

  it("shows the exception note and special-hours slots for a special day", () => {
    atNow(OPEN_NOW);
    renderCheckout(OPEN_NOW);
    fireEvent.click(screen.getByTestId("timing-scheduled-option"));
    fireEvent.change(screen.getByTestId("checkout-date-input"), {
      target: { value: "2026-11-30" },
    });

    expect(optionValues(screen.getByTestId("checkout-time-input"))).toEqual([
      "10:00",
      "10:15",
      "10:30",
      "10:45",
      "11:00",
      "11:15",
      "11:30",
      "11:45",
    ]);
    expect(screen.getByTestId("checkout-time-field").textContent).toContain("Market day");
  });

  it("keeps a free time input and the 30-day window when the business has no structured hours", () => {
    atNow(OPEN_NOW);
    renderCheckout(OPEN_NOW, { settings: { ...settings, weeklyHours: null, hoursExceptions: [] } });
    fireEvent.click(screen.getByTestId("timing-scheduled-option"));

    const dates = optionValues(screen.getByTestId("checkout-date-input"));
    expect(dates).toHaveLength(31);
    expect(dates).toContain("2026-11-29");
    expect((screen.getByTestId("checkout-time-input") as HTMLInputElement).type).toBe("time");
  });

  it("closed shop: schedule only, notice with the next opening, no ASAP", () => {
    atNow(CLOSED_NOW);
    renderCheckout(CLOSED_NOW, { isOpen: false });

    expect(screen.queryByTestId("timing-asap-option")).toBeNull();
    const notice = screen.getByTestId("checkout-closed-schedule-notice");
    expect(notice.textContent).toContain("Tomorrow at 11:30");
    // Today has no slots left, so the first offered day is tomorrow.
    expect(optionValues(screen.getByTestId("checkout-date-input"))[0]).toBe("2026-11-27");
  });

  it("closed between service ranges today: requires a time and blocks until one is chosen", () => {
    atNow(BETWEEN_NOW);
    renderCheckout(BETWEEN_NOW, { isOpen: false });

    expect(screen.getByTestId("checkout-closed-schedule-notice").textContent).toContain("14:00");
    fillContact();
    fireEvent.change(screen.getByTestId("checkout-date-input"), {
      target: { value: "2026-11-26" },
    });

    // No error before interaction, and Place order stays enabled (field-level issue).
    const button = screen.getByTestId("place-order-button") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(screen.queryByTestId("checkout-time-field-error")).toBeNull();
    expect(screen.queryByTestId("checkout-blocked-reason")).toBeNull();

    // A submit attempt explains the missing time and focuses the field.
    fireEvent.click(button);
    expect(screen.getByTestId("checkout-time-field-error").textContent).toBe(
      dict.checkoutTimeRequired,
    );
    expect(document.activeElement).toBe(screen.getByTestId("checkout-time-input"));

    fireEvent.change(screen.getByTestId("checkout-time-input"), { target: { value: "14:00" } });
    expect(screen.queryByTestId("checkout-time-field-error")).toBeNull();
  });

  it("shows the time-required message once the time field was touched", () => {
    atNow(BETWEEN_NOW);
    renderCheckout(BETWEEN_NOW, { isOpen: false });
    fireEvent.change(screen.getByTestId("checkout-date-input"), {
      target: { value: "2026-11-26" },
    });
    fireEvent.blur(screen.getByTestId("checkout-time-input"));
    expect(screen.getByTestId("checkout-time-field-error").textContent).toBe(
      dict.checkoutTimeRequired,
    );
  });

  it("follows the ticking clock for open/closed instead of a stale isOpen prop", () => {
    atNow("2026-11-26T09:58:00Z"); // 10:58 Paris, open until 12:00
    renderCheckout("2026-11-26T09:58:00Z", { isOpen: false });
    expect(screen.queryByTestId("checkout-closed-schedule-notice")).toBeNull();
    expect(screen.getByTestId("timing-asap-option")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(65 * 60 * 1000); // 12:03, between ranges
    });
    expect(screen.getByTestId("checkout-closed-schedule-notice")).toBeTruthy();
    expect(screen.queryByTestId("timing-asap-option")).toBeNull();
  });

  it("blocks ordering with a clear message when the shop is not accepting orders", () => {
    atNow(OPEN_NOW);
    renderCheckout(OPEN_NOW, { isAcceptingOrders: false, isOpen: false });

    expect(screen.getByTestId("checkout-not-accepting-notice").textContent).toBe(
      dict.checkoutBlockedNotAccepting,
    );
    expect((screen.getByTestId("place-order-button") as HTMLButtonElement).disabled).toBe(true);
    // The sentence is announced once (top alert), not repeated under the button.
    expect(screen.queryByTestId("checkout-blocked-reason")).toBeNull();
    expect(screen.getByTestId("checkout-blocked-reason-region").getAttribute("aria-live")).toBe(
      "polite",
    );
  });

  it("explains a stale pick inline and disables Place order once the slot has passed", () => {
    atNow(OPEN_NOW);
    renderCheckout(OPEN_NOW);
    fireEvent.click(screen.getByTestId("timing-scheduled-option"));
    fillContact();
    fireEvent.change(screen.getByTestId("checkout-date-input"), {
      target: { value: "2026-11-26" },
    });
    fireEvent.change(screen.getByTestId("checkout-time-input"), { target: { value: "11:15" } });

    const button = screen.getByTestId("place-order-button") as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    act(() => {
      vi.advanceTimersByTime(20 * 60 * 1000); // page left open until 11:20
    });

    expect(screen.getByTestId("checkout-time-field-error").textContent).toBe(
      dict.orderErrorSlotTimeInPast,
    );
    expect(button.disabled).toBe(false);
    // The stale pick stays in its sorted place, disabled and flagged as unavailable.
    const options = within(screen.getByTestId("checkout-time-input")).getAllByRole(
      "option",
    ) as HTMLOptionElement[];
    const stale = options.find((o) => o.value === "11:15");
    expect(stale?.disabled).toBe(true);
    expect(stale?.textContent).toBe("11:15 (unavailable)");
    const values = options.map((o) => o.value).filter(Boolean);
    expect(values).toEqual(values.toSorted());
  });

  it("sends isAsap explicitly: true for ASAP and false for a scheduled slot", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date"] });
    atNow(OPEN_NOW);
    const actionSpy = vi
      .spyOn(await import("../storefront-actions"), "placeOrderAction")
      .mockResolvedValue({
        ok: true,
        data: {
          orderId: "o1",
          orderNumber: 1,
          trackingToken: "t1",
          status: "NEW",
          totalAmount: 440,
        },
      });

    const first = renderCheckout(OPEN_NOW);
    fillContact();
    fireEvent.submit(screen.getByTestId("checkout-form"));
    await waitFor(() => expect(actionSpy).toHaveBeenCalledTimes(1));
    expect(actionSpy.mock.calls[0][0]).toMatchObject({ isAsap: true });
    first.unmount();

    resetCartStore();
    resetGuestContactCache();
    renderCheckout(OPEN_NOW);
    fireEvent.click(screen.getByTestId("timing-scheduled-option"));
    fillContact();
    fireEvent.change(screen.getByTestId("checkout-date-input"), {
      target: { value: "2026-11-27" },
    });
    fireEvent.change(screen.getByTestId("checkout-time-input"), { target: { value: "12:00" } });
    fireEvent.submit(screen.getByTestId("checkout-form"));
    await waitFor(() => expect(actionSpy).toHaveBeenCalledTimes(2));
    expect(actionSpy.mock.calls[1][0]).toMatchObject({
      isAsap: false,
      requestedDate: "2026-11-27",
      requestedTime: "12:00",
    });
    actionSpy.mockRestore();
  });
});
