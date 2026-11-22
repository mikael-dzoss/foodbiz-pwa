import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import OrderTrackingPage, { generateMetadata } from "../page";
import ConfirmationPage, { generateMetadata as confirmationMetadata } from "../confirmed/page";
import { getDictionary } from "@/domain/i18n";
import { createDefaultFixtures } from "@/lib/repositories/mock/fixtures";
import type { Order, Business } from "@/domain";

const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

const mockOrder: Order = {
  id: "ord-99",
  businessId: "biz-1",
  orderNumber: 99,
  guestId: "00000000-0000-4000-8000-000000000001",
  serviceType: "pickup",
  channel: "storefront",
  status: "NEW",
  paid: "unpaid",
  paymentPreference: "on_handover",
  paymentMethod: null,
  paidAt: null,
  requestedDate: "2026-10-17",
  requestedTime: null,
  items: [
    {
      productId: "prod-1",
      productName: "Tarte Tatin",
      quantity: 1,
      unitPrice: 500,
      totalPrice: 500,
    },
  ],
  totalAmount: 500,
  trackingToken: "token-99",
  cancellationReason: null,
  notes: null,
  deliveryAddress: null,
  createdAt: "2026-10-17T12:00:00.000Z",
  updatedAt: "2026-10-17T12:00:00.000Z",
};

const mockBusiness: Business = {
  id: "biz-1",
  name: "Boulangerie Test",
  slug: "boulangerie-test",
  phone: "+33123456789",
  email: "test@example.com",
  address: "10 Rue du Four",
  currency: "EUR",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

let currentOrder: Order | null = mockOrder;

vi.mock("@/lib/repositories/storefront", () => ({
  getStorefrontRepositories: () => ({
    orders: {
      findByTrackingToken: vi.fn(async (token: string) => {
        if (token === "token-99") return currentOrder;
        return null;
      }),
    },
    business: {
      findById: vi.fn(async () => mockBusiness),
      getSettings: vi.fn(async () => createDefaultFixtures().settings),
    },
  }),
}));

describe("OrderTrackingPage Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentOrder = mockOrder;
  });

  it("renders order tracking view when token is valid", async () => {
    const page = await OrderTrackingPage({
      params: Promise.resolve({ locale: "en", token: "token-99" }),
    });

    render(page);
    expect(screen.getByTestId("tracking-order-title").textContent).toContain("Order #99");
    expect(screen.getByText("Tarte Tatin")).toBeDefined();
  });

  it("calls notFound when order token does not exist", async () => {
    await OrderTrackingPage({
      params: Promise.resolve({ locale: "en", token: "nonexistent-token" }),
    });

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("generates translated privacy-safe metadata without leaking order details", async () => {
    for (const locale of ["en", "fr"] as const) {
      const dict = getDictionary(locale);
      const meta = await generateMetadata({
        params: Promise.resolve({ locale, token: "token-99" }),
      });
      expect(meta.title).toBe(dict.orderTracking.title);
      expect(meta.description).toBe(dict.storefront.metaOrderTrackingDescription);
      expect(String(meta.title)).not.toContain("99");
      expect(String(meta.description)).not.toContain("99");
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(meta.referrer).toBe("no-referrer");
    }
  });

  it("keeps unknown-token metadata non-indexable and translated", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: "fr", token: "unknown" }),
    });
    expect(meta.title).toBe(getDictionary("fr").orderTracking.title);
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.referrer).toBe("no-referrer");
  });

  it("renders a reloadable French confirmation with a token-preserving tracking link", async () => {
    render(
      await ConfirmationPage({
        params: Promise.resolve({ locale: "fr", token: "token-99" }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: getDictionary("fr").orderConfirmation.title }),
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: getDictionary("fr").storefront.trackOrder })
        .getAttribute("href"),
    ).toBe("/fr/order/token-99");
  });

  it("does not render a confirmation for an invalid token", async () => {
    await ConfirmationPage({ params: Promise.resolve({ locale: "en", token: "unknown" }) });
    expect(mockNotFound).toHaveBeenCalledOnce();
  });

  it("marks confirmation metadata noindex with translated title and description in both languages", async () => {
    for (const locale of ["en", "fr"] as const) {
      const meta = await confirmationMetadata({
        params: Promise.resolve({ locale, token: "token-99" }),
      });
      expect(meta.title).toBe(getDictionary(locale).orderConfirmation.title);
      expect(meta.description).toBe(getDictionary(locale).orderConfirmation.receivedHelp);
      expect(String(meta.title)).not.toContain("99");
      expect(String(meta.description)).not.toContain("99");
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(meta.referrer).toBe("no-referrer");
    }
  });
});
