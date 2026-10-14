import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { OrderDetail } from "../components/order-detail";
import type { EnrichedOrder } from "../order-actions";
import * as actions from "../order-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockOrder: EnrichedOrder = {
  id: "ord-1",
  businessId: "biz-1",
  orderNumber: 42,
  guestId: "g-1",
  guestName: "Jean Dupont",
  guestPhone: "+33612345678",
  guestEmail: "jean@example.com",
  serviceType: "delivery",
  channel: "phone",
  status: "PREPARING",
  paid: "unpaid",
  paymentPreference: "revolut",
  paymentMethod: null,
  paidAt: null,
  requestedDate: "2026-10-13",
  requestedTime: "19:30",
  items: [
    {
      id: "it-1",
      productId: "p-1",
      productName: "Burger Maison",
      quantity: 2,
      unitPrice: 850,
      totalPrice: 1700,
    },
  ],
  totalAmount: 1700,
  trackingToken: "tk-42",
  cancellationReason: null,
  notes: "No onions",
  deliveryAddress: "123 Rue de la Paix, Paris",
  statusHistory: [
    { status: "NEW", timestamp: "2026-10-13T18:45:00.000Z", note: "Created" },
    { status: "CONFIRMED", timestamp: "2026-10-13T18:46:00.000Z", note: "Confirmed" },
    { status: "PREPARING", timestamp: "2026-10-13T18:50:00.000Z", note: "In kitchen" },
  ],
  createdAt: "2026-10-13T18:45:00.000Z",
  updatedAt: "2026-10-13T18:50:00.000Z",
};

describe("OrderDetail Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders order reference, guest details, items, and notes", () => {
    render(<OrderDetail order={mockOrder} />);

    expect(screen.getByText("Order #42")).toBeDefined();
    expect(screen.getByText("Jean Dupont")).toBeDefined();
    expect(screen.getByText("+33612345678")).toBeDefined();
    expect(screen.getByText("123 Rue de la Paix, Paris")).toBeDefined();
    expect(screen.getByTestId("order-items-card").textContent).toContain("Burger Maison");
    expect(screen.getByTestId("order-items-card").textContent).toContain("2×");
    expect(screen.getByText(/No onions/)).toBeDefined();
    expect(screen.getByTestId("call-guest-button").getAttribute("href")).toBe("tel:+33612345678");
    expect(screen.getByTestId("whatsapp-guest-button").getAttribute("href")).toBe(
      "https://wa.me/33612345678",
    );
    expect(screen.getByTestId("print-ticket-button")).toBeDefined();
  });

  it("displays payment status with icon and text (not color only)", () => {
    render(<OrderDetail order={mockOrder} />);
    const paymentCard = screen.getByTestId("payment-card");

    expect(paymentCard.textContent).toContain("Unpaid");
    expect(screen.getByTestId("record-payment-button")).toBeDefined();
  });

  it("renders status history timeline with all logged events", () => {
    render(<OrderDetail order={mockOrder} />);
    const timelineCard = screen.getByTestId("order-timeline-card");

    expect(timelineCard.textContent).toContain("NEW");
    expect(timelineCard.textContent).toContain("CONFIRMED");
    expect(timelineCard.textContent).toContain("PREPARING");
    expect(timelineCard.textContent).toContain("In kitchen");
  });

  it("displays next valid status action and triggers progression", async () => {
    const progressSpy = vi.spyOn(actions, "progressOrderStatusAction").mockResolvedValueOnce({
      success: true,
      data: {
        ...mockOrder,
        status: "READY",
      },
    });

    render(<OrderDetail order={mockOrder} />);
    const nextBtn = screen.getByTestId("next-status-action-button");
    expect(nextBtn.textContent).toContain("Mark as ready");

    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(progressSpy).toHaveBeenCalledWith({
        orderId: "ord-1",
        nextStatus: "READY",
      });
    });
  });

  it("disables complete action and shows warning when order is READY and unpaid", () => {
    const readyUnpaidOrder: EnrichedOrder = {
      ...mockOrder,
      status: "READY",
      paid: "unpaid",
    };

    render(<OrderDetail order={readyUnpaidOrder} />);
    const nextBtn = screen.getByTestId("next-status-action-button") as HTMLButtonElement;
    expect(nextBtn.textContent).toContain("Complete order");
    expect(nextBtn.disabled).toBe(true);
    expect(screen.getByText(/Payment required before completing order handover/i)).toBeDefined();
  });

  it("opens cancel dialog and cancels order with reason", async () => {
    const cancelSpy = vi.spyOn(actions, "progressOrderStatusAction").mockResolvedValueOnce({
      success: true,
      data: {
        ...mockOrder,
        status: "CANCELLED",
        cancellationReason: "Client called to cancel",
      },
    });

    render(<OrderDetail order={mockOrder} />);
    fireEvent.click(screen.getByTestId("cancel-order-button"));

    expect(screen.getByTestId("cancel-order-dialog")).toBeDefined();

    const reasonInput = screen.getByTestId("cancel-reason-input");
    fireEvent.change(reasonInput, { target: { value: "Client called to cancel" } });

    fireEvent.click(screen.getByTestId("confirm-cancel-button"));

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith({
        orderId: "ord-1",
        nextStatus: "CANCELLED",
        reason: "Client called to cancel",
      });
    });
  });

  it("records payment via payment dialog", async () => {
    const paySpy = vi.spyOn(actions, "recordPaymentAction").mockResolvedValueOnce({
      success: true,
      data: {
        ...mockOrder,
        paid: "paid",
        paymentMethod: "revolut",
        paidAt: new Date().toISOString(),
      },
    });

    render(<OrderDetail order={mockOrder} />);
    fireEvent.click(screen.getByTestId("record-payment-button"));

    expect(screen.getByTestId("record-payment-dialog")).toBeDefined();

    fireEvent.click(screen.getByTestId("payment-method-revolut"));
    fireEvent.click(screen.getByTestId("confirm-payment-button"));

    await waitFor(() => {
      expect(paySpy).toHaveBeenCalledWith({
        orderId: "ord-1",
        paymentMethod: "revolut",
      });
    });
  });

  it("shows Refund Due badge and records refund when cancelled paid order is viewed", async () => {
    const refundSpy = vi.spyOn(actions, "recordRefundAction").mockResolvedValueOnce({
      success: true,
      data: {
        ...mockOrder,
        status: "CANCELLED",
        paid: "refunded",
        refundedAt: "2026-10-13T19:00:00.000Z",
      },
    });

    const cancelledPaidOrder: EnrichedOrder = {
      ...mockOrder,
      status: "CANCELLED",
      paid: "paid",
      paymentMethod: "revolut",
      paidAt: "2026-10-13T18:46:00.000Z",
    };

    render(<OrderDetail order={cancelledPaidOrder} />);

    expect(screen.getByTestId("refund-due-badge")).toBeDefined();
    expect(screen.getByTestId("record-refund-cta")).toBeDefined();

    fireEvent.click(screen.getByTestId("record-refund-cta"));
    expect(screen.getByTestId("record-refund-dialog")).toBeDefined();

    const reasonInput = screen.getByTestId("refund-reason-input");
    fireEvent.change(reasonInput, { target: { value: "Full refund to Revolut" } });

    fireEvent.click(screen.getByTestId("confirm-refund-button"));

    await waitFor(() => {
      expect(refundSpy).toHaveBeenCalledWith({
        orderId: "ord-1",
        reason: "Full refund to Revolut",
      });
    });
  });

  it("renders Refunded badge and timestamp when order is refunded", () => {
    const refundedOrder: EnrichedOrder = {
      ...mockOrder,
      status: "CANCELLED",
      paid: "refunded",
      refundedAt: "2026-10-13T19:00:00.000Z",
    };

    render(<OrderDetail order={refundedOrder} />);

    expect(screen.getByTestId("refunded-badge")).toBeDefined();
    expect(screen.getByTestId("payment-card").textContent).toContain("Refunded");
  });

  it("disables complete action when order is READY and refunded", () => {
    const readyRefundedOrder: EnrichedOrder = {
      ...mockOrder,
      status: "READY",
      paid: "refunded",
    };

    render(<OrderDetail order={readyRefundedOrder} />);
    const nextBtn = screen.getByTestId("next-status-action-button") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
    expect(screen.getByText(/Payment required before completing order handover/i)).toBeDefined();
  });
});
