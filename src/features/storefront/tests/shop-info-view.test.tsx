import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShopInfoView } from "../components/shop-info-view";
import { formatMoney } from "@/domain/formatting/money";
import { DEFAULT_LEAD_TIME, formatLeadTime } from "@/domain/lead-time";
import { enDictionary, frDictionary } from "@/domain/i18n";
import { demoBusiness, demoSettings } from "@/lib/repositories/mock/fixtures";
import type { Business, BusinessSettings } from "@/domain/business";

const mockBusiness: Business = {
  ...demoBusiness,
  id: "biz-1",
  latitude: null,
  longitude: null,
};

const mockSettings: BusinessSettings = {
  ...demoSettings,
  businessId: "biz-1",
  minOrderAmount: 0,
  leadTimeValue: 1,
  leadTimeUnit: "business_days",
  revolutRevtag: "",
  weroIdentifier: "",
};

describe("ShopInfoView (#83)", () => {
  it("renders store name, description, services, contact channels, and address", () => {
    render(
      <ShopInfoView
        business={mockBusiness}
        settings={mockSettings}
        locale="en"
        dict={enDictionary.storefront}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: demoBusiness.name })).toBeDefined();
    expect(screen.getByText(demoBusiness.description!)).toBeDefined();
    expect(screen.getByText("Pickup ready in ~1 business day")).toBeDefined();
    expect(screen.getAllByText("~1 business day").length).toBeGreaterThan(0);

    // Enabled services
    expect(screen.getByText(enDictionary.storefront.servicePickup)).toBeDefined();

    // WhatsApp link
    const waLink = screen.getByRole("link", {
      name: new RegExp(enDictionary.storefront.chatOnWhatsApp),
    });
    expect(waLink.getAttribute("href")).toBe(
      `https://wa.me/${demoBusiness.whatsappNumber!.replace(/\D/g, "")}`,
    );

    // Phone link
    const phoneLink = screen.getByRole("link", {
      name: new RegExp(enDictionary.storefront.callShop),
    });
    expect(phoneLink.getAttribute("href")).toBe(`tel:${demoBusiness.phone}`);

    // Email link
    const emailLink = screen.getByRole("link", {
      name: new RegExp(enDictionary.storefront.emailShop),
    });
    expect(emailLink.getAttribute("href")).toBe(`mailto:${demoBusiness.email}`);

    // Weekly Opening hours & Fulfillment badges
    expect(screen.getByText(enDictionary.storefront.weeklyOpeningHours)).toBeDefined();
    expect(screen.getByText("FREE")).toBeDefined();
    expect(screen.getByText("PAID")).toBeDefined();

    // Address & Directions
    expect(screen.getByText(demoBusiness.address!)).toBeDefined();
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

  it("renders OpenStreetMap embed iframe and attribution link when coordinates are set (#195)", () => {
    const businessWithCoords: Business = {
      ...mockBusiness,
      latitude: 48.8553,
      longitude: 2.3726,
    };

    render(
      <ShopInfoView
        business={businessWithCoords}
        settings={mockSettings}
        locale="en"
        dict={enDictionary.storefront}
      />,
    );

    const iframe = screen.getByTestId("shop-info-osm-map") as HTMLIFrameElement;
    expect(iframe.getAttribute("src")).toBe(
      "https://www.openstreetmap.org/export/embed.html?bbox=2.3686,48.8513,2.3766,48.8593&layer=mapnik&marker=48.8553,2.3726",
    );
    expect(iframe.getAttribute("loading")).toBe("lazy");
    expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(iframe.getAttribute("title")).toBe(`Map showing ${demoBusiness.name} location`);

    const attrLink = screen.getByTestId("osm-attribution-link");
    expect(attrLink.getAttribute("href")).toBe("https://www.openstreetmap.org/copyright");
    expect(attrLink.textContent).toBe("© OpenStreetMap contributors");
    expect(screen.queryByTestId("shop-info-map-placeholder")).toBeNull();
  });

  it("renders neutral placeholder when coordinates are missing while keeping Directions link (#195)", () => {
    render(
      <ShopInfoView
        business={mockBusiness}
        settings={mockSettings}
        locale="en"
        dict={enDictionary.storefront}
      />,
    );

    expect(screen.getByTestId("shop-info-map-placeholder")).toBeDefined();
    expect(screen.queryByTestId("shop-info-osm-map")).toBeNull();
    expect(
      screen.getByRole("link", { name: new RegExp(enDictionary.storefront.getDirections) }),
    ).toBeDefined();
  });

  it("exposes anchor targets for every footer section link (#233)", () => {
    const { container } = render(
      <ShopInfoView
        business={mockBusiness}
        settings={mockSettings}
        locale="en"
        dict={enDictionary.storefront}
      />,
    );
    for (const id of ["overview", "contact", "hours", "location", "ordering-policy"]) {
      const section = container.querySelector(`section#${id}`);
      expect(section, id).not.toBeNull();
      const labelledBy = section!.getAttribute("aria-labelledby");
      expect(labelledBy && container.querySelector(`#${labelledBy}`), id).not.toBeNull();
      expect(section!.className).toContain("scroll-mt-20");
    }
  });

  it("keeps the return-to-catalog bar in the page flow above the footer (#249)", () => {
    render(
      <ShopInfoView
        business={mockBusiness}
        settings={mockSettings}
        locale="en"
        dict={enDictionary.storefront}
      />,
    );
    const bar = screen.getByTestId("shop-info-action-bar");
    expect(bar.className).toContain("sticky");
    expect(bar.className).not.toMatch(/\bfixed\b/);
    const returnLink = screen.getByRole("link", {
      name: new RegExp(enDictionary.storefront.returnToCatalog),
    });
    expect(bar.contains(returnLink)).toBe(true);
  });

  describe("ordering policy card (#302)", () => {
    it("never invents amounts when settings are null and shows the default lead time", () => {
      const { container } = render(
        <ShopInfoView
          business={mockBusiness}
          settings={null}
          locale="en"
          dict={enDictionary.storefront}
        />,
      );

      const section = container.querySelector("section#ordering-policy");
      expect(section).not.toBeNull();
      const policy = within(section as HTMLElement);

      expect(
        policy.getByRole("heading", { level: 2, name: enDictionary.storefront.deliveryPolicy }),
      ).toBeDefined();
      expect(policy.getByText(enDictionary.storefront.acceptedPayments)).toBeDefined();
      expect(policy.getByTestId("ordering-policy-grid").className).toContain("grid-cols-1");
      expect(policy.queryByTestId("policy-tile-min-order")).toBeNull();
      expect(policy.queryByTestId("policy-tile-delivery-fee")).toBeNull();
      expect(policy.queryByText(formatMoney(1500, "en"))).toBeNull();
      expect(policy.queryByText(formatMoney(250, "en"))).toBeNull();
      expect(policy.getByTestId("policy-tile-est-time").textContent).toContain(
        formatLeadTime(DEFAULT_LEAD_TIME, "en"),
      );
    });

    it("hides individual unset tiles and adapts the grid cleanly for 1 or 2 tiles", () => {
      const oneTileSettings = {
        ...mockSettings,
        minOrderAmount: undefined,
        deliveryFee: null,
        leadTimeValue: 30,
        leadTimeUnit: "minutes",
      } as unknown as BusinessSettings;

      const { container, rerender } = render(
        <ShopInfoView
          business={mockBusiness}
          settings={oneTileSettings}
          locale="en"
          dict={enDictionary.storefront}
        />,
      );

      const section = container.querySelector("section#ordering-policy") as HTMLElement;
      const policy = within(section);

      const oneTileGrid = policy.getByTestId("ordering-policy-grid");
      expect(oneTileGrid.className).toContain("grid-cols-1");
      expect(policy.queryByTestId("policy-tile-min-order")).toBeNull();
      expect(policy.queryByTestId("policy-tile-delivery-fee")).toBeNull();
      expect(policy.getByTestId("policy-tile-est-time").textContent).toContain("~30 min");
      expect(policy.queryByText(formatMoney(1500, "en"))).toBeNull();
      expect(policy.queryByText(formatMoney(250, "en"))).toBeNull();

      const twoTileSettings = {
        ...mockSettings,
        minOrderAmount: 1200,
        deliveryFee: undefined,
        leadTimeValue: 30,
        leadTimeUnit: "minutes",
      } as unknown as BusinessSettings;

      rerender(
        <ShopInfoView
          business={mockBusiness}
          settings={twoTileSettings}
          locale="en"
          dict={enDictionary.storefront}
        />,
      );

      const twoTileGrid = policy.getByTestId("ordering-policy-grid");
      expect(twoTileGrid.className).toContain("grid-cols-2");
      expect(twoTileGrid.className).not.toContain("sm:grid-cols-3");
      expect(policy.getByTestId("policy-tile-min-order").textContent).toContain(
        formatMoney(1200, "en"),
      );
      expect(policy.queryByTestId("policy-tile-delivery-fee")).toBeNull();
      expect(policy.getByTestId("policy-tile-est-time").textContent).toContain("~30 min");
    });

    it("renders configured zero amounts as real formatted values across a tidy 3-tile grid", () => {
      const zeroSettings: BusinessSettings = {
        ...mockSettings,
        minOrderAmount: 0,
        deliveryFee: 0,
        leadTimeValue: 20,
        leadTimeUnit: "minutes",
      };

      const { container } = render(
        <ShopInfoView
          business={mockBusiness}
          settings={zeroSettings}
          locale="en"
          dict={enDictionary.storefront}
        />,
      );

      const section = container.querySelector("section#ordering-policy") as HTMLElement;
      const policy = within(section);

      const grid = policy.getByTestId("ordering-policy-grid");
      expect(grid.className).toContain("grid-cols-2");
      expect(grid.className).toContain("sm:grid-cols-3");

      const minOrderTile = policy.getByTestId("policy-tile-min-order");
      expect(minOrderTile.textContent).toContain(enDictionary.storefront.policyMinOrder);
      expect(minOrderTile.textContent).toContain(formatMoney(0, "en"));

      const deliveryFeeTile = policy.getByTestId("policy-tile-delivery-fee");
      expect(deliveryFeeTile.textContent).toContain(enDictionary.storefront.policyDeliveryFee);
      expect(deliveryFeeTile.textContent).toContain(formatMoney(0, "en"));

      const estTimeTile = policy.getByTestId("policy-tile-est-time");
      expect(estTimeTile.textContent).toContain(enDictionary.storefront.policyEstTime);
      expect(estTimeTile.textContent).toContain("~20 min");
      expect(estTimeTile.className).toContain("col-span-2");
      expect(estTimeTile.className).toContain("sm:col-span-1");
    });

    it("renders French policy labels from the FR dictionary instead of English literals", () => {
      const frSettings: BusinessSettings = {
        ...mockSettings,
        minOrderAmount: 1500,
        deliveryFee: 0,
        leadTimeValue: 2,
        leadTimeUnit: "hours",
      };

      const { container } = render(
        <ShopInfoView
          business={mockBusiness}
          settings={frSettings}
          locale="fr"
          dict={frDictionary.storefront}
        />,
      );

      const section = container.querySelector("section#ordering-policy") as HTMLElement;
      const policy = within(section);

      expect(policy.getByText(frDictionary.storefront.policyMinOrder)).toBeDefined();
      expect(policy.getByText(frDictionary.storefront.policyDeliveryFee)).toBeDefined();
      expect(policy.getByText(frDictionary.storefront.policyEstTime)).toBeDefined();
      expect(policy.getByTestId("policy-tile-min-order").textContent).toContain(
        formatMoney(1500, "fr"),
      );
      expect(policy.getByTestId("policy-tile-delivery-fee").textContent).toContain(
        formatMoney(0, "fr"),
      );
      expect(policy.getByTestId("policy-tile-est-time").textContent).toContain("~2 heures");

      expect(policy.queryByText(enDictionary.storefront.policyMinOrder)).toBeNull();
      expect(policy.queryByText(enDictionary.storefront.policyDeliveryFee)).toBeNull();
      expect(policy.queryByText(enDictionary.storefront.policyEstTime)).toBeNull();
    });
  });
});
