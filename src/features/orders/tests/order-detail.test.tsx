import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManagerLocaleProvider } from "@/components/i18n";
import { OrderDetail } from "../components/order-detail";
import type { EnrichedOrder } from "../order-data";
import { BusinessTimeZoneProvider } from "@/components/time/business-timezone";
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

    expect(timelineCard.textContent).toContain("(New)");
    expect(timelineCard.textContent).toContain("(Confirmed)");
    expect(timelineCard.textContent).toContain("(Preparing)");
    expect(timelineCard.textContent).toContain("In kitchen");
  });

  it("displays next valid status action and triggers progression", async () => {
    const progressSpy = vi.spyOn(actions, "progressOrderStatusAction").mockResolvedValueOnce({
      ok: true,
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

  it("renders French copy and a French action error for a failed progression", async () => {
    vi.spyOn(actions, "progressOrderStatusAction").mockResolvedValueOnce({
      ok: false,
      code: "CONFLICT",
      message: "Order was changed by someone else",
    });

    render(
      <ManagerLocaleProvider locale="fr">
        <OrderDetail order={mockOrder} />
      </ManagerLocaleProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Commande n° 42");
    expect(screen.getByTestId("guest-service-card").textContent).toContain("Livraison");
    const nextBtn = screen.getByTestId("next-status-action-button");
    expect(nextBtn.textContent).toContain("Marquer comme prête");

    fireEvent.click(nextBtn);

    const error = await screen.findByTestId("order-detail-error");
    expect(error.textContent).toBe("Ceci a changé entre-temps. Rechargez la page et réessayez.");
  });

  it("shows warning and dynamically displays 'Mark paid & complete' instead of 'Complete order' when order is READY and unpaid", () => {
    const readyUnpaidOrder: EnrichedOrder = {
      ...mockOrder,
      status: "READY",
      paid: "unpaid",
    };

    render(<OrderDetail order={readyUnpaidOrder} />);
    expect(screen.getByText(/Payment required before completing order handover/i)).toBeDefined();
    expect(screen.queryByText("Complete order")).toBeNull();
    const shortcutBtn = screen.getByTestId("mark-paid-and-complete-button");
    expect(shortcutBtn.textContent).toContain("Mark paid & complete");
  });

  it("displays enabled 'Complete order' action when order is READY and paid", async () => {
    const completeSpy = vi.spyOn(actions, "progressOrderStatusAction").mockResolvedValueOnce({
      ok: true,
      data: {
        ...mockOrder,
        status: "COMPLETED",
        paid: "paid",
      },
    });

    const readyPaidOrder: EnrichedOrder = {
      ...mockOrder,
      status: "READY",
      paid: "paid",
      paymentMethod: "cash",
      paidAt: "2026-10-13T18:46:00.000Z",
    };

    render(<OrderDetail order={readyPaidOrder} />);
    const nextBtn = screen.getByTestId("next-status-action-button") as HTMLButtonElement;
    expect(nextBtn.textContent).toContain("Complete order");
    expect(nextBtn.disabled).toBe(false);

    fireEvent.click(nextBtn);
    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith({
        orderId: "ord-1",
        nextStatus: "COMPLETED",
      });
    });
  });

  it("refund control is enabled for an owner and disabled with a reason otherwise", () => {
    const completedPaid: EnrichedOrder = {
      ...mockOrder,
      status: "COMPLETED",
      paid: "paid",
      paymentMethod: "cash",
    };
    const { unmount } = render(<OrderDetail order={completedPaid} />);
    expect(
      (screen.getByTestId("post-completion-refund-button") as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(screen.queryByTestId("refund-owner-only")).toBeNull();
    unmount();

    render(<OrderDetail order={completedPaid} refundDisabledReason="Only the shop owner." />);
    const btn = screen.getByTestId("post-completion-refund-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-describedby")).toBe("refund-owner-only");
    expect(screen.getByTestId("refund-owner-only").textContent).toBe("Only the shop owner.");
  });

  it("opens cancel dialog and cancels order with reason", async () => {
    const cancelSpy = vi.spyOn(actions, "progressOrderStatusAction").mockResolvedValueOnce({
      ok: true,
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
      ok: true,
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

  it("allows recording payment via card and renders the Card label (#377)", async () => {
    const paySpy = vi.spyOn(actions, "recordPaymentAction").mockResolvedValueOnce({
      ok: true,
      data: {
        ...mockOrder,
        paid: "paid",
        paymentMethod: "card",
        paidAt: "2026-10-13T18:46:00.000Z",
      },
    });

    render(<OrderDetail order={mockOrder} />);
    fireEvent.click(screen.getByTestId("record-payment-button"));

    const cardOption = screen.getByTestId("payment-method-card");
    expect(cardOption.textContent).toContain("Card");
    expect(cardOption.className).not.toContain("capitalize");
    fireEvent.click(cardOption);
    fireEvent.click(screen.getByTestId("confirm-payment-button"));

    await waitFor(() => {
      expect(paySpy).toHaveBeenCalledWith({
        orderId: "ord-1",
        paymentMethod: "card",
      });
    });
    expect(screen.getByTestId("payment-card").textContent).toContain("Card");
  });

  it("shows Refund Due badge and records refund when cancelled paid order is viewed", async () => {
    const refundSpy = vi.spyOn(actions, "recordRefundAction").mockResolvedValueOnce({
      ok: true,
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

  it("shows 'refund manually' warning inside cancel dialog when cancelling an already paid order (AC of #55)", () => {
    const paidOrder: EnrichedOrder = {
      ...mockOrder,
      status: "PREPARING",
      paid: "paid",
      paymentMethod: "cash",
      paidAt: "2026-10-13T18:46:00.000Z",
    };

    render(<OrderDetail order={paidOrder} />);
    fireEvent.click(screen.getByTestId("cancel-order-button"));

    expect(screen.getByTestId("cancel-order-dialog")).toBeDefined();
    const warning = screen.getByTestId("cancel-paid-warning");
    expect(warning.textContent).toContain("refund");
    expect(warning.textContent).toContain("Cash");
  });

  it("allows manager to mark paid order as unpaid to undo a mistake (AC 1 of #53)", async () => {
    const unpaidSpy = vi.spyOn(actions, "markOrderUnpaidAction").mockResolvedValueOnce({
      ok: true,
      data: {
        ...mockOrder,
        paid: "unpaid",
        paymentMethod: null,
        paidAt: null,
      },
    });

    const paidOrder: EnrichedOrder = {
      ...mockOrder,
      status: "PREPARING",
      paid: "paid",
      paymentMethod: "cash",
      paidAt: "2026-10-13T18:46:00.000Z",
    };

    render(<OrderDetail order={paidOrder} />);
    const undoBtn = screen.getByTestId("mark-unpaid-button");
    expect(undoBtn.textContent).toContain("Mark as unpaid");

    fireEvent.click(undoBtn);

    await waitFor(() => {
      expect(unpaidSpy).toHaveBeenCalledWith({
        orderId: "ord-1",
      });
    });
  });

  it("renders 'Mark paid & complete' shortcut when READY and unpaid (AC 3 of #53)", async () => {
    const shortcutSpy = vi.spyOn(actions, "markPaidAndCompleteAction").mockResolvedValueOnce({
      ok: true,
      data: {
        ...mockOrder,
        status: "COMPLETED",
        paid: "paid",
        paymentMethod: "wero",
        paidAt: new Date().toISOString(),
      },
    });

    const readyUnpaidOrder: EnrichedOrder = {
      ...mockOrder,
      status: "READY",
      paid: "unpaid",
    };

    render(<OrderDetail order={readyUnpaidOrder} />);
    const shortcutBtn = screen.getByTestId("mark-paid-and-complete-button");
    expect(shortcutBtn.textContent).toContain("Mark paid & complete");

    fireEvent.click(shortcutBtn);

    expect(screen.getByTestId("record-payment-dialog")).toBeDefined();
    fireEvent.click(screen.getByTestId("payment-method-wero"));
    fireEvent.click(screen.getByTestId("confirm-payment-button"));

    await waitFor(() => {
      expect(shortcutSpy).toHaveBeenCalledWith({
        orderId: "ord-1",
        paymentMethod: "wero",
      });
    });
  });

  describe("Web orders: Accept and Reject (Story #54)", () => {
    const newOrder: EnrichedOrder = {
      ...mockOrder,
      status: "NEW",
      channel: "storefront",
    };

    it("displays Accept order and Reject order buttons for NEW orders", () => {
      render(<OrderDetail order={newOrder} />);

      const acceptBtn = screen.getByTestId("accept-order-button");
      const rejectBtn = screen.getByTestId("reject-order-button");

      expect(acceptBtn).toBeDefined();
      expect(acceptBtn.textContent).toContain("Accept order");
      expect(rejectBtn).toBeDefined();
      expect(rejectBtn.textContent).toContain("Reject order");
      expect(screen.queryByTestId("cancel-order-button")).toBeNull();
    });

    it("clicking Accept order calls progressOrderStatusAction with CONFIRMED status", async () => {
      const progressSpy = vi.spyOn(actions, "progressOrderStatusAction").mockResolvedValueOnce({
        ok: true,
        data: {
          ...newOrder,
          status: "CONFIRMED",
        },
      });

      render(<OrderDetail order={newOrder} />);
      const acceptBtn = screen.getByTestId("accept-order-button");
      fireEvent.click(acceptBtn);

      await waitFor(() => {
        expect(progressSpy).toHaveBeenCalledWith({
          orderId: "ord-1",
          nextStatus: "CONFIRMED",
        });
      });
    });

    it("clicking Reject order opens dialog and requires a non-empty reason", async () => {
      const progressSpy = vi.spyOn(actions, "progressOrderStatusAction").mockResolvedValueOnce({
        ok: true,
        data: {
          ...newOrder,
          status: "CANCELLED",
          cancellationReason: "Kitchen at capacity",
        },
      });

      render(<OrderDetail order={newOrder} />);
      const rejectBtn = screen.getByTestId("reject-order-button");
      fireEvent.click(rejectBtn);

      expect(screen.getByTestId("reject-order-dialog")).toBeDefined();

      const confirmBtn = screen.getByTestId("confirm-reject-button") as HTMLButtonElement;
      expect(confirmBtn.disabled).toBe(true);

      const reasonInput = screen.getByTestId("reject-reason-input");
      fireEvent.change(reasonInput, { target: { value: "Kitchen at capacity" } });
      expect(confirmBtn.disabled).toBe(false);

      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(progressSpy).toHaveBeenCalledWith({
          orderId: "ord-1",
          nextStatus: "CANCELLED",
          reason: "Kitchen at capacity",
        });
      });
    });

    it("renders submittedName mismatch badge when order has a differing submittedName", () => {
      render(<OrderDetail order={{ ...mockOrder, submittedName: "Marc" }} />);
      const badge = screen.getByTestId("order-submitted-name-badge");
      expect(badge.textContent).toBe("Ordered as Marc");
    });
  });
});

describe("OrderDetail time zone (#168)", () => {
  const paidOrder: EnrichedOrder = {
    ...mockOrder,
    paid: "paid",
    paymentMethod: "cash",
    paidAt: "2026-10-13T22:46:00.000Z",
    createdAt: "2026-10-13T22:45:00.000Z",
    statusHistory: [{ status: "NEW", timestamp: "2026-10-13T22:45:00.000Z", note: "Created" }],
  };

  function renderIn(timeZone: string) {
    const { container, unmount } = render(
      <BusinessTimeZoneProvider timeZone={timeZone}>
        <OrderDetail order={paidOrder} />
      </BusinessTimeZoneProvider>,
    );
    const text = container.textContent ?? "";
    unmount();
    return text;
  }

  it("renders every timestamp in the business time zone", () => {
    // 22:45 UTC is 00:45 on the 14th in Paris and 18:45 on the 13th in New York
    const paris = renderIn("Europe/Paris");
    expect(paris).toContain("Created on 14 October 2026 at 00:45");
    expect(paris).toContain("on 14/10/2026 at 00:46");
    expect(paris).toContain("14/10/2026 • 00:45");

    const newYork = renderIn("America/New_York");
    expect(newYork).toContain("Created on 13 October 2026 at 18:45");
    expect(newYork).toContain("on 13/10/2026 at 18:46");
  });

  it("renders the same text whatever the server or device time zone is", () => {
    const previous = process.env.TZ;
    try {
      const outputs = ["Pacific/Auckland", "America/Los_Angeles", "UTC"].map((zone) => {
        process.env.TZ = zone;
        return renderIn("Europe/Paris");
      });
      expect(outputs[1]).toBe(outputs[0]);
      expect(outputs[2]).toBe(outputs[0]);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});
