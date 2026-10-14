import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ManualOrderForm } from "../components/manual-order-form";
import type { Product } from "@/domain";
import * as actions from "../order-actions";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockProducts: Product[] = [
  {
    id: "p-1",
    businessId: "biz-1",
    categoryId: "cat-1",
    name: "Burger Maison",
    description: null,
    price: 850,
    unitCost: 300,
    stock: 5,
    visible: true,
    imageUrl: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  },
  {
    id: "p-2",
    businessId: "biz-1",
    categoryId: "cat-1",
    name: "Frites Maison",
    description: null,
    price: 450,
    unitCost: 150,
    stock: 0, // Out of stock
    visible: true,
    imageUrl: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  },
];

describe("ManualOrderForm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all form sections and products with stock badges", () => {
    render(<ManualOrderForm products={mockProducts} />);

    expect(screen.getByText("Step 1: Guest Information")).toBeDefined();
    expect(screen.getByText("Step 2: Service & Timing")).toBeDefined();
    expect(screen.getByText("Step 3: Product Selection")).toBeDefined();
    expect(screen.getByText("Step 4: Order Summary")).toBeDefined();

    expect(screen.getByText("Burger Maison")).toBeDefined();
    expect(screen.getByText(/5 in stock/)).toBeDefined();
    expect(screen.getByText("Frites Maison")).toBeDefined();
    expect(screen.getByText("Out of stock")).toBeDefined();
  });

  it("opens order preview modal when clicking preview button", () => {
    render(<ManualOrderForm products={mockProducts} />);
    const previewBtn = screen.getByTestId("preview-order-button");
    fireEvent.click(previewBtn);

    expect(screen.getByTestId("order-preview-dialog")).toBeDefined();
    expect(screen.getByText("Order Preview")).toBeDefined();
  });

  it("looks up existing guest on phone blur and auto-fills name", async () => {
    vi.spyOn(actions, "lookupGuestByPhoneAction").mockResolvedValueOnce({
      success: true,
      data: {
        id: "g-1",
        businessId: "biz-1",
        name: "Jean Dupont",
        phone: "+33612345678",
        email: "jean@test.com",
        address: "10 Rue de Paris",
        notes: null,
        createdAt: "2026-10-01T10:00:00.000Z",
      },
    });

    render(<ManualOrderForm products={mockProducts} />);
    const phoneInput = screen.getByTestId("guest-phone-input");

    fireEvent.change(phoneInput, { target: { value: "+33612345678" } });
    fireEvent.blur(phoneInput);

    await waitFor(() => {
      expect(screen.getByTestId("guest-matched-badge")).toBeDefined();
      expect((screen.getByTestId("guest-name-input") as HTMLInputElement).value).toBe(
        "Jean Dupont",
      );
    });
  });

  it("increments quantity and updates order total", () => {
    render(<ManualOrderForm products={mockProducts} />);

    // Burger stepper
    const burgerRow = screen.getByTestId("product-row-p-1");
    const incrementBtn = burgerRow.querySelector('button[aria-label="Increase quantity"]')!;

    fireEvent.click(incrementBtn);
    fireEvent.click(incrementBtn);

    // Total should be 2 * 8.50 = 17.00
    expect(screen.getByTestId("create-order-submit-button").textContent).toContain("€17.00");
  });

  it("prevents incrementing out of stock product", () => {
    render(<ManualOrderForm products={mockProducts} />);

    // Frites stepper has stock 0
    const fritesRow = screen.getByTestId("product-row-p-2");
    const incrementBtn = fritesRow.querySelector(
      'button[aria-label="Increase quantity"]',
    )! as HTMLButtonElement;
    expect(incrementBtn.disabled).toBe(true);
  });

  it("shows delivery address field when delivery is selected", () => {
    render(<ManualOrderForm products={mockProducts} />);
    expect(screen.queryByTestId("delivery-address-input")).toBeNull();

    fireEvent.click(screen.getByTestId("service-type-delivery"));
    expect(screen.getByTestId("delivery-address-input")).toBeDefined();
  });

  it("submits manual order and redirects on success", async () => {
    const createSpy = vi.spyOn(actions, "createManualOrderAction").mockResolvedValueOnce({
      success: true,
      data: {
        id: "ord-new-1",
        businessId: "biz-1",
        orderNumber: 43,
        guestId: "g-1",
        guestName: "Jean Dupont",
        serviceType: "pickup",
        channel: "phone",
        status: "CONFIRMED",
        paid: "unpaid",
        paymentPreference: "on_handover",
        paymentMethod: null,
        paidAt: null,
        requestedDate: "2026-10-13",
        requestedTime: null,
        items: [],
        totalAmount: 850,
        createdAt: "2026-10-13T12:00:00.000Z",
        updatedAt: "2026-10-13T12:00:00.000Z",
      },
    });

    render(<ManualOrderForm products={mockProducts} />);

    // Fill phone and name
    fireEvent.change(screen.getByTestId("guest-phone-input"), {
      target: { value: "+33612345678" },
    });
    fireEvent.change(screen.getByTestId("guest-name-input"), {
      target: { value: "Jean Dupont" },
    });

    // Select 1 burger
    const burgerRow = screen.getByTestId("product-row-p-1");
    const incrementBtn = burgerRow.querySelector('button[aria-label="Increase quantity"]')!;
    fireEvent.click(incrementBtn);

    // Submit
    fireEvent.click(screen.getByTestId("create-order-submit-button"));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          guestPhone: "+33612345678",
          guestName: "Jean Dupont",
          serviceType: "pickup",
          channel: "phone",
          items: [{ productId: "p-1", quantity: 1 }],
        }),
      );
      expect(mockPush).toHaveBeenCalledWith("/manage/orders/ord-new-1");
    });
  });
});
