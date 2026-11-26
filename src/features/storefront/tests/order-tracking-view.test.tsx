import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderTrackingView } from "../components/order-tracking-view";
import { getDictionary } from "@/domain/i18n";
import { DEMO_PRODUCT, demoBusiness } from "@/lib/repositories/mock/fixtures";
import type { Order, Business } from "@/domain";

const mockBusiness: Business = {
  ...demoBusiness,
  id: "biz-1",
};

const mockActiveOrder: Order = {
  id: "ord-42",
  businessId: "biz-1",
  orderNumber: 42,
  guestId: "g-1",
  serviceType: "pickup",
  channel: "storefront",
  status: "CONFIRMED",
  paid: "paid",
  paymentPreference: "revolut",
  paymentMethod: "revolut",
  paidAt: "2026-10-17T12:05:00.000Z",
  requestedDate: "2026-10-17",
  requestedTime: "12:30",
  items: [
    {
      id: "it-1",
      productId: "prod-1",
      productName: DEMO_PRODUCT.pouletBraise.name,
      quantity: 2,
      unitPrice: DEMO_PRODUCT.pouletBraise.price,
      totalPrice: DEMO_PRODUCT.pouletBraise.price * 2,
    },
    {
      id: "it-2",
      productId: "prod-2",
      productName: DEMO_PRODUCT.folere.name,
      quantity: 1,
      unitPrice: DEMO_PRODUCT.folere.price,
      totalPrice: DEMO_PRODUCT.folere.price,
    },
  ],
  totalAmount: DEMO_PRODUCT.pouletBraise.price * 2 + DEMO_PRODUCT.folere.price,
  trackingToken: "tk-42",
  cancellationReason: null,
  notes: null,
  deliveryAddress: null,
  statusHistory: [
    { status: "NEW", timestamp: "2026-10-17T12:00:00.000Z", note: "Online order" },
    { status: "CONFIRMED", timestamp: "2026-10-17T12:05:00.000Z", note: "Kitchen accepted" },
  ],
  createdAt: "2026-10-17T12:00:00.000Z",
  updatedAt: "2026-10-17T12:05:00.000Z",
};

const mockCancelledOrder: Order = {
  ...mockActiveOrder,
  id: "ord-43",
  orderNumber: 43,
  status: "CANCELLED",
  cancellationReason: `Kitchen out of ingredients for ${DEMO_PRODUCT.pouletBraise.name}`,
  statusHistory: [
    { status: "NEW", timestamp: "2026-10-17T12:00:00.000Z", note: "Online order" },
    {
      status: "CANCELLED",
      timestamp: "2026-10-17T12:06:00.000Z",
      note: `Kitchen out of ingredients for ${DEMO_PRODUCT.pouletBraise.name}`,
    },
  ],
  updatedAt: "2026-10-17T12:06:00.000Z",
};

describe("OrderTrackingView Component (Story #54 AC 3)", () => {
  const enDict = getDictionary("en");
  const frDict = getDictionary("fr");

  it("renders order reference, items, fulfillment, and confirmed status", () => {
    render(
      <OrderTrackingView
        timeZone="Europe/Paris"
        order={mockActiveOrder}
        business={mockBusiness}
        locale="en"
        dict={enDict.orderTracking}
      />,
    );

    expect(screen.getByTestId("tracking-order-title").textContent).toContain("Order #42");
    expect(screen.getByTestId("tracking-status-badge").textContent).toContain(
      "Confirmed by kitchen",
    );
    expect(screen.getByText(DEMO_PRODUCT.pouletBraise.name)).toBeDefined();
    expect(screen.getByText(DEMO_PRODUCT.folere.name)).toBeDefined();
    expect(screen.getByText(demoBusiness.address!)).toBeDefined();
    expect(screen.getByTestId("tracking-directions-link").getAttribute("href")).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(demoBusiness.address!)}`,
    );
    expect(screen.getByTestId("tracking-pickup-icon")).toBeDefined();
    expect(screen.queryByTestId("tracking-delivery-icon")).toBeNull();
    expect(screen.queryByTestId("tracking-delivery-address")).toBeNull();
    expect(screen.getByTestId("tracking-contact-button").getAttribute("href")).toContain(
      `tel:${demoBusiness.phone!.replace(/\D/g, "")}`,
    );
    expect(screen.getByTestId("tracking-back-button").getAttribute("href")).toBe("/en");
  });

  it("reflects CANCELLED outcome with reason from kitchen", () => {
    render(
      <OrderTrackingView
        timeZone="Europe/Paris"
        order={mockCancelledOrder}
        business={mockBusiness}
        locale="en"
        dict={enDict.orderTracking}
      />,
    );

    // Cancelled status badge
    expect(screen.getByTestId("tracking-status-badge").textContent).toContain("Order Cancelled");

    // Prominent cancellation banner
    const banner = screen.getByTestId("tracking-cancellation-banner");
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain("Order Cancelled");

    // Rejection reason
    const reason = screen.getByTestId("tracking-cancellation-reason");
    expect(reason.textContent).toContain(
      `Kitchen out of ingredients for ${DEMO_PRODUCT.pouletBraise.name}`,
    );
  });

  it("renders French localization cleanly", () => {
    render(
      <OrderTrackingView
        timeZone="Europe/Paris"
        order={mockCancelledOrder}
        business={mockBusiness}
        locale="fr"
        dict={frDict.orderTracking}
      />,
    );

    expect(screen.getByTestId("tracking-status-badge").textContent).toContain("Commande annulée");
    expect(screen.getByTestId("tracking-cancellation-banner").textContent).toContain(
      "Commande annulée",
    );
    expect(screen.getByTestId("tracking-cancellation-banner").textContent).toContain(
      "Kitchen out of ingredients",
    );
  });

  it("renders delivery address under Delivery to without shop address, Directions link, or notes (#352)", () => {
    const deliveryOrder: Order = {
      ...mockActiveOrder,
      id: "ord-deliv",
      orderNumber: 55,
      serviceType: "delivery",
      deliveryAddress: "42 Avenue des Champs-Élysées, 75008 Paris",
      paid: "unpaid",
      notes: "Please ring door code 4589B",
      status: "PREPARING",
    };

    render(
      <OrderTrackingView
        timeZone="Europe/Paris"
        order={deliveryOrder}
        business={mockBusiness}
        locale="en"
        dict={enDict.orderTracking}
      />,
    );

    expect(screen.getByText("Delivery")).toBeDefined();
    expect(screen.getByTestId("tracking-delivery-icon")).toBeDefined();
    expect(screen.queryByTestId("tracking-pickup-icon")).toBeNull();
    const deliverySection = screen.getByTestId("tracking-delivery-address");
    expect(deliverySection.tagName).toBe("DL");
    expect(deliverySection.querySelector("dt")?.textContent).toBe("Delivery to");
    expect(deliverySection.querySelector("dd")?.textContent).toBe(
      "42 Avenue des Champs-Élysées, 75008 Paris",
    );
    expect(screen.queryByText(demoBusiness.address!)).toBeNull();
    expect(screen.queryByTestId("tracking-directions-link")).toBeNull();
    expect(screen.queryByText("Please ring door code 4589B")).toBeNull();
    expect(screen.getByText(enDict.orderTracking.unpaidBadge)).toBeDefined();
    expect(screen.getByTestId("tracking-status-badge").textContent).toContain("Preparing");
  });

  it("renders French delivery label and hides shop address when delivery address is missing (#352)", () => {
    const frDeliveryOrder: Order = {
      ...mockActiveOrder,
      id: "ord-deliv-fr",
      orderNumber: 56,
      serviceType: "delivery",
      deliveryAddress: "12 Rue de Rivoli, 75001 Paris",
    };

    const { rerender } = render(
      <OrderTrackingView
        timeZone="Europe/Paris"
        order={frDeliveryOrder}
        business={mockBusiness}
        locale="fr"
        dict={frDict.orderTracking}
      />,
    );

    expect(screen.getByText("Détails de la commande")).toBeDefined();
    const deliverySection = screen.getByTestId("tracking-delivery-address");
    expect(deliverySection.tagName).toBe("DL");
    expect(deliverySection.querySelector("dt")?.textContent).toBe("Livraison à");
    expect(deliverySection.querySelector("dd")?.textContent).toBe("12 Rue de Rivoli, 75001 Paris");
    expect(screen.queryByText(demoBusiness.address!)).toBeNull();
    expect(screen.queryByTestId("tracking-directions-link")).toBeNull();

    rerender(
      <OrderTrackingView
        timeZone="Europe/Paris"
        order={{ ...frDeliveryOrder, deliveryAddress: null }}
        business={mockBusiness}
        locale="fr"
        dict={frDict.orderTracking}
      />,
    );

    expect(screen.queryByTestId("tracking-delivery-address")).toBeNull();
    expect(screen.queryByText(demoBusiness.address!)).toBeNull();
    expect(screen.queryByTestId("tracking-directions-link")).toBeNull();
  });

  it("renders COMPLETED and READY order statuses", () => {
    const readyOrder: Order = {
      ...mockActiveOrder,
      id: "ord-ready",
      status: "READY",
    };

    const { rerender } = render(
      <OrderTrackingView
        timeZone="Europe/Paris"
        order={readyOrder}
        business={mockBusiness}
        locale="en"
        dict={enDict.orderTracking}
      />,
    );

    expect(screen.getByTestId("tracking-status-badge").textContent).toContain("Ready");

    const completedOrder: Order = {
      ...mockActiveOrder,
      id: "ord-comp",
      status: "COMPLETED",
    };

    rerender(
      <OrderTrackingView
        timeZone="Europe/Paris"
        order={completedOrder}
        business={mockBusiness}
        locale="en"
        dict={enDict.orderTracking}
      />,
    );

    expect(screen.getByTestId("tracking-status-badge").textContent).toContain("Completed");
  });

  it("shows the placement time in the business time zone, not the device's (#168)", () => {
    const order: Order = { ...mockActiveOrder, createdAt: "2026-10-13T22:45:00.000Z" };
    const text = (zone: string) => {
      const { container, unmount } = render(
        <OrderTrackingView
          timeZone={zone}
          order={order}
          business={mockBusiness}
          locale="en"
          dict={enDict.orderTracking}
        />,
      );
      const content = container.textContent ?? "";
      unmount();
      return content;
    };

    expect(text("Europe/Paris")).toContain("00:45");
    expect(text("America/New_York")).toContain("18:45");
  });

  it("shows Collect at block with relay name, address, and encoded Directions link (#387)", () => {
    const relayAddress = "12 Place Jean Jaurès, 93100 Montreuil";
    const { rerender } = render(
      <OrderTrackingView
        timeZone="Europe/Paris"
        order={{
          ...mockActiveOrder,
          serviceType: "pickup",
          pickupLocation: { name: "Marché de Montreuil", address: relayAddress },
        }}
        business={mockBusiness}
        locale="en"
        dict={enDict.orderTracking}
      />,
    );

    const pickupBlock = screen.getByTestId("tracking-pickup-location");
    expect(pickupBlock.querySelector("dt")?.textContent).toBe("Collect at");
    expect(pickupBlock.querySelectorAll("dd")).toHaveLength(1);
    expect(screen.getByTestId("tracking-pickup-name").textContent).toBe("Marché de Montreuil");
    expect(screen.getByTestId("tracking-pickup-address").textContent).toBe(relayAddress);
    const link = screen.getByTestId("tracking-directions-link");
    expect(link.getAttribute("href")).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(relayAddress)}`,
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("aria-label")).toBe(
      "Directions to Marché de Montreuil (opens in a new tab)",
    );

    // Shop fallback when pickupLocation has null name (tracking RPC shape)
    rerender(
      <OrderTrackingView
        timeZone="Europe/Paris"
        order={{
          ...mockActiveOrder,
          serviceType: "pickup",
          pickupLocation: { name: null, address: demoBusiness.address! },
        }}
        business={mockBusiness}
        locale="fr"
        dict={frDict.orderTracking}
      />,
    );
    expect(screen.getByTestId("tracking-pickup-location").querySelector("dt")?.textContent).toBe(
      "Retrait à",
    );
    expect(screen.getByTestId("tracking-pickup-name").textContent).toBe(mockBusiness.name);
    expect(screen.getByTestId("tracking-pickup-address").textContent).toBe(demoBusiness.address);
    expect(screen.getByTestId("tracking-directions-link").getAttribute("href")).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(demoBusiness.address!)}`,
    );
    expect(screen.getByTestId("tracking-directions-link").getAttribute("aria-label")).toBe(
      `Itinéraire vers ${mockBusiness.name} (ouvre un nouvel onglet)`,
    );

    // Delivery shows nothing for Collect at even if pickupLocation were present
    rerender(
      <OrderTrackingView
        timeZone="Europe/Paris"
        order={{
          ...mockActiveOrder,
          serviceType: "delivery",
          deliveryAddress: "10 Rue de Rivoli, 75001 Paris",
          pickupLocation: { name: "Marché de Montreuil", address: relayAddress },
        }}
        business={mockBusiness}
        locale="en"
        dict={enDict.orderTracking}
      />,
    );
    expect(screen.queryByTestId("tracking-pickup-location")).toBeNull();
    expect(screen.queryByTestId("tracking-directions-link")).toBeNull();
  });
});
