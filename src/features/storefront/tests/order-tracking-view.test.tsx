import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderTrackingView } from "../components/order-tracking-view";
import { getDictionary } from "@/domain/i18n";
import type { Order, Business } from "@/domain";

const mockBusiness: Business = {
  id: "biz-1",
  name: "La Petite Boulangerie",
  slug: "la-petite-boulangerie",
  phone: "+33 1 43 55 67 89",
  email: "contact@boulangerie.fr",
  address: "14 Rue de la Paix, 75002 Paris",
  currency: "EUR",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
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
      productName: "Croissant aux Amandes",
      quantity: 2,
      unitPrice: 350,
      totalPrice: 700,
    },
    {
      id: "it-2",
      productId: "prod-2",
      productName: "Café Latte",
      quantity: 1,
      unitPrice: 450,
      totalPrice: 450,
    },
  ],
  totalAmount: 1150,
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
  cancellationReason: "Kitchen out of ingredients for Almond Croissants",
  statusHistory: [
    { status: "NEW", timestamp: "2026-10-17T12:00:00.000Z", note: "Online order" },
    {
      status: "CANCELLED",
      timestamp: "2026-10-17T12:06:00.000Z",
      note: "Kitchen out of ingredients for Almond Croissants",
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
    expect(screen.getByText("Croissant aux Amandes")).toBeDefined();
    expect(screen.getByText("Café Latte")).toBeDefined();
    expect(screen.getByText("14 Rue de la Paix, 75002 Paris")).toBeDefined();
    expect(screen.getByTestId("tracking-contact-button").getAttribute("href")).toContain(
      "tel:33143556789",
    );
    expect(screen.getByTestId("tracking-back-button").getAttribute("href")).toBe("/en");
  });

  it("reflects CANCELLED outcome with reason from kitchen", () => {
    render(
      <OrderTrackingView
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
    expect(reason.textContent).toContain("Kitchen out of ingredients for Almond Croissants");
  });

  it("renders French localization cleanly", () => {
    render(
      <OrderTrackingView
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

  it("renders delivery progress and unpaid status without private address or notes", () => {
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
        order={deliveryOrder}
        business={mockBusiness}
        locale="en"
        dict={enDict.orderTracking}
      />,
    );

    expect(screen.getByText("Delivery")).toBeDefined();
    expect(screen.queryByText("42 Avenue des Champs-Élysées, 75008 Paris")).toBeNull();
    expect(screen.queryByText("Please ring door code 4589B")).toBeNull();
    expect(screen.getByText(enDict.orderTracking.unpaidBadge)).toBeDefined();
    expect(screen.getByTestId("tracking-status-badge").textContent).toContain("Preparing");
  });

  it("renders COMPLETED and READY order statuses", () => {
    const readyOrder: Order = {
      ...mockActiveOrder,
      id: "ord-ready",
      status: "READY",
    };

    const { rerender } = render(
      <OrderTrackingView
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
        order={completedOrder}
        business={mockBusiness}
        locale="en"
        dict={enDict.orderTracking}
      />,
    );

    expect(screen.getByTestId("tracking-status-badge").textContent).toContain("Completed");
  });
});
