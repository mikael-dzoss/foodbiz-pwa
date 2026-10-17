import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShopInfoView } from "../components/shop-info-view";
import { enDictionary, frDictionary } from "@/domain/i18n";
import type { Business, BusinessSettings } from "@/domain/business";

const mockBusiness: Business = {
  id: "biz-1",
  name: "La Boulangerie",
  slug: "la-boulangerie",
  description: "Traditional sourdough and pastries",
  phone: "+33 1 23 45 67 89",
  email: "bonjour@boulangerie.fr",
  whatsappNumber: "+33 6 12 34 56 78",
  address: "15 Rue Oberkampf, 75011 Paris",
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
  openingHours: "Tue-Sat: 07:30 - 19:30",
  orderTimingAsap: true,
  orderTimingScheduled: true,
  orderTimingTimeOptional: true,
  deliveryFee: 350,
  minOrderAmount: 0,
  revolutRevtag: "",
  weroIdentifier: "",
  paymentMethods: {
    cash: true,
    revolut: true,
    wero: true,
  },
  paymentInstructionsEn: "",
  paymentInstructionsFr: "",
  inAppAlerts: true,
  soundAlerts: true,
};

describe("ShopInfoView (#83)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders store name, description, services, contact channels, and address", () => {
    render(
      <ShopInfoView
        business={mockBusiness}
        settings={mockSettings}
        locale="en"
        dict={enDictionary.storefront}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "La Boulangerie" })).toBeDefined();
    expect(screen.getByText("Traditional sourdough and pastries")).toBeDefined();

    // Enabled services
    expect(screen.getByText(enDictionary.storefront.servicePickup)).toBeDefined();

    // WhatsApp link
    const waLink = screen.getByRole("link", {
      name: new RegExp(enDictionary.storefront.chatOnWhatsApp),
    });
    expect(waLink.getAttribute("href")).toBe("https://wa.me/33612345678");

    // Phone link
    const phoneLink = screen.getByRole("link", {
      name: new RegExp(enDictionary.storefront.callShop),
    });
    expect(phoneLink.getAttribute("href")).toBe("tel:+33 1 23 45 67 89");

    // Email link
    const emailLink = screen.getByRole("link", {
      name: new RegExp(enDictionary.storefront.emailShop),
    });
    expect(emailLink.getAttribute("href")).toBe("mailto:bonjour@boulangerie.fr");

    // Weekly Opening hours & Fulfillment badges
    expect(screen.getByText(enDictionary.storefront.weeklyOpeningHours)).toBeDefined();
    expect(screen.getByText("FREE")).toBeDefined();
    expect(screen.getByText("PAID")).toBeDefined();

    // Address & Directions
    expect(screen.getByText("15 Rue Oberkampf, 75011 Paris")).toBeDefined();
    const directionsLink = screen.getByRole("link", {
      name: new RegExp(enDictionary.storefront.getDirections),
    });
    expect(directionsLink.getAttribute("href")).toContain("google.com/maps");
  });

  it("omits contact channels, address, and hours when not configured", () => {
    const minimalBusiness: Business = {
      ...mockBusiness,
      phone: undefined,
      email: undefined,
      whatsappNumber: undefined,
      address: undefined,
    };

    const minimalSettings: BusinessSettings = {
      ...mockSettings,
      openingHours: "",
      serviceTypes: {
        pickup: true,
        delivery: false,
        dineIn: false,
      },
    };

    render(
      <ShopInfoView
        business={minimalBusiness}
        settings={minimalSettings}
        locale="en"
        dict={enDictionary.storefront}
      />,
    );

    expect(screen.queryByText(enDictionary.storefront.chatOnWhatsApp)).toBeNull();
    expect(screen.queryByText(enDictionary.storefront.callShop)).toBeNull();
    expect(screen.queryByText(enDictionary.storefront.emailShop)).toBeNull();
    expect(screen.queryByText(enDictionary.storefront.address)).toBeNull();
    expect(screen.queryByText(enDictionary.storefront.getDirections)).toBeNull();
  });

  it("renders French dictionary strings properly", () => {
    render(
      <ShopInfoView
        business={mockBusiness}
        settings={mockSettings}
        locale="fr"
        dict={frDictionary.storefront}
      />,
    );

    expect(screen.getByText(frDictionary.storefront.services)).toBeDefined();
    expect(screen.getByText(frDictionary.storefront.contact)).toBeDefined();
    expect(screen.getByText(frDictionary.storefront.openHours)).toBeDefined();
    expect(screen.getByText(frDictionary.storefront.address)).toBeDefined();
  });

  it("renders Stitch C-03 elements: weekly hours table with Today badge, holiday panel with SoonBadge, and return button", () => {
    render(
      <ShopInfoView
        business={mockBusiness}
        settings={mockSettings}
        locale="en"
        dict={enDictionary.storefront}
      />,
    );

    // Weekly opening hours header & Today badge
    expect(screen.getByText(enDictionary.storefront.weeklyOpeningHours)).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.today)).toBeDefined();

    // Holiday schedule notice
    expect(screen.getByText(enDictionary.storefront.holidayScheduleNotice)).toBeDefined();

    // Accepted payments & card tap soon badge
    expect(screen.getByText(enDictionary.storefront.acceptedPayments)).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.cashOnPickup)).toBeDefined();

    // Soon badges on holiday schedule & card tap
    const soonBadges = screen.getAllByText("Soon");
    expect(soonBadges.length).toBeGreaterThanOrEqual(2);

    // Sticky Return to Catalog CTA
    const returnLink = screen.getByRole("link", {
      name: new RegExp(enDictionary.storefront.returnToCatalog),
    });
    expect(returnLink.getAttribute("href")).toBe("/en");
  });
});
