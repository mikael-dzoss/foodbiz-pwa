import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManagerLocaleProvider } from "@/components/i18n";
import { ManualOrderForm } from "../components/manual-order-form";
import type { ManualOrderPickupOption } from "../order-data";
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
    allergens: [],
    suggestAddOns: true,
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
    allergens: [],
    suggestAddOns: true,
    imageUrl: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  },
];

describe("ManualOrderForm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all form sections and products with stock badges", () => {
    render(<ManualOrderForm today="2026-10-15" products={mockProducts} />);

    expect(screen.getByText("Step 1: Guest Information")).toBeDefined();
    expect(screen.getByText("Step 2: Service & Timing")).toBeDefined();
    expect(screen.getByText("Step 3: Product Selection")).toBeDefined();
    expect(screen.getByText("Step 4: Order Summary")).toBeDefined();

    expect(screen.getByText("Burger Maison")).toBeDefined();
    expect(screen.getByText(/5 in stock/)).toBeDefined();
    expect(screen.getByText("Frites Maison")).toBeDefined();
    expect(screen.getByText("Out of stock")).toBeDefined();
  });

  it("renders boxed cancel button in header and opens order preview modal via preview & create", () => {
    render(<ManualOrderForm today="2026-10-15" products={mockProducts} />);
    expect(screen.getByTestId("cancel-header-button")).toBeDefined();

    // Select 1 burger, fill guest name & phone
    fireEvent.change(screen.getByTestId("guest-phone-input"), {
      target: { value: "+33612345678" },
    });
    fireEvent.change(screen.getByTestId("guest-name-input"), {
      target: { value: "Jean Dupont" },
    });
    const burgerRow = screen.getByTestId("product-row-p-1");
    const incrementBtn = burgerRow.querySelector('button[aria-label="Increase quantity"]')!;
    fireEvent.click(incrementBtn);

    const previewBtn = screen.getByTestId("create-order-submit-button");
    fireEvent.click(previewBtn);

    expect(screen.getByTestId("order-preview-dialog")).toBeDefined();
    expect(screen.getByText("Order Preview")).toBeDefined();
  });

  it("looks up existing guest on phone blur, locks name input, and unlocks with pencil button and toast", async () => {
    vi.spyOn(actions, "lookupGuestByPhoneAction").mockResolvedValueOnce({
      ok: true,
      data: {
        id: "g-1",
        name: "Jean Dupont",
        address: "10 Rue de Paris",
      },
    });

    render(<ManualOrderForm today="2026-10-15" products={mockProducts} />);
    const phoneInput = screen.getByTestId("guest-phone-input");

    fireEvent.change(phoneInput, { target: { value: "+33612345678" } });
    fireEvent.blur(phoneInput);

    await waitFor(() => {
      expect(screen.getByTestId("guest-matched-badge")).toBeDefined();
      const nameInput = screen.getByTestId("guest-name-input") as HTMLInputElement;
      expect(nameInput.value).toBe("Jean Dupont");
      expect(nameInput.disabled).toBe(true);
    });

    // Click pencil button to unlock
    const unlockBtn = screen.getByTestId("unlock-guest-name-button");
    fireEvent.click(unlockBtn);

    const nameInputAfter = screen.getByTestId("guest-name-input") as HTMLInputElement;
    expect(nameInputAfter.disabled).toBe(false);
    expect(screen.getByTestId("guest-name-update-toast").textContent).toContain(
      "Editing this name will update it for all orders linked to this phone number",
    );
  });

  it("disables preview button until phone and name pass syntax validation", () => {
    render(<ManualOrderForm today="2026-10-15" products={mockProducts} />);

    // Select 1 burger
    const burgerRow = screen.getByTestId("product-row-p-1");
    const incrementBtn = burgerRow.querySelector('button[aria-label="Increase quantity"]')!;
    fireEvent.click(incrementBtn);

    const previewBtn = screen.getByTestId("create-order-submit-button") as HTMLButtonElement;
    expect(previewBtn.disabled).toBe(true);

    // Invalid phone + valid name -> still disabled
    fireEvent.change(screen.getByTestId("guest-phone-input"), { target: { value: "123" } });
    fireEvent.change(screen.getByTestId("guest-name-input"), { target: { value: "Jean Dupont" } });
    expect(previewBtn.disabled).toBe(true);

    // Valid phone + 1-char invalid name -> still disabled
    fireEvent.change(screen.getByTestId("guest-phone-input"), {
      target: { value: "06 12 34 56 78" },
    });
    fireEvent.change(screen.getByTestId("guest-name-input"), { target: { value: "J" } });
    expect(previewBtn.disabled).toBe(true);

    // Valid phone + valid 2+ char name -> enabled!
    fireEvent.change(screen.getByTestId("guest-name-input"), { target: { value: "Jean Dupont" } });
    expect(previewBtn.disabled).toBe(false);
  });

  it("increments quantity and updates order total", () => {
    render(<ManualOrderForm today="2026-10-15" products={mockProducts} />);

    // Burger stepper
    const burgerRow = screen.getByTestId("product-row-p-1");
    const incrementBtn = burgerRow.querySelector('button[aria-label="Increase quantity"]')!;

    fireEvent.click(incrementBtn);
    fireEvent.click(incrementBtn);

    // Total should be 2 * 8.50 = 17.00
    expect(screen.getByTestId("create-order-submit-button").textContent).toContain("€17.00");
  });

  it("prevents incrementing out of stock product", () => {
    render(<ManualOrderForm today="2026-10-15" products={mockProducts} />);

    // Frites stepper has stock 0
    const fritesRow = screen.getByTestId("product-row-p-2");
    const incrementBtn = fritesRow.querySelector(
      'button[aria-label="Increase quantity"]',
    )! as HTMLButtonElement;
    expect(incrementBtn.disabled).toBe(true);
  });

  it("shows delivery address field when delivery is selected", () => {
    render(<ManualOrderForm today="2026-10-15" products={mockProducts} />);
    expect(screen.queryByTestId("delivery-address-input")).toBeNull();

    fireEvent.click(screen.getByTestId("service-type-delivery"));
    expect(screen.getByTestId("delivery-address-input")).toBeDefined();
  });

  it("submits manual order through preview confirmation and redirects on success", async () => {
    const createSpy = vi.spyOn(actions, "createManualOrderAction").mockResolvedValueOnce({
      ok: true,
      data: {
        id: "ord-new-1",
        businessId: "biz-1",
        orderNumber: 43,
        guestId: "g-1",
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

    render(<ManualOrderForm today="2026-10-15" products={mockProducts} />);

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

    // Open Preview via bottom bar button
    fireEvent.click(screen.getByTestId("create-order-submit-button"));

    // Modal appears
    expect(screen.getByTestId("order-preview-dialog")).toBeDefined();

    // Confirm & Create in dialog
    fireEvent.click(screen.getByTestId("confirm-create-order-button"));

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

  describe("Pickup location selector (#387)", () => {
    const relayA: ManualOrderPickupOption = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Gare RER B - La Plaine",
      address: "Place du 8 mai 1945",
      postcode: "93210",
      feeCents: 0,
    };
    const relayB: ManualOrderPickupOption = {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Marché de Montreuil",
      address: "12 Place Jean Jaurès",
      postcode: "93100",
      feeCents: 200,
    };

    function fillValidGuestAndItem() {
      fireEvent.change(screen.getByTestId("guest-phone-input"), {
        target: { value: "+33612345678" },
      });
      fireEvent.change(screen.getByTestId("guest-name-input"), {
        target: { value: "Jean Dupont" },
      });
      const burgerRow = screen.getByTestId("product-row-p-1");
      const incrementBtn = burgerRow.querySelector('button[aria-label="Increase quantity"]')!;
      fireEvent.click(incrementBtn);
    }

    it("hides pickup location select when there are no active relays", () => {
      render(
        <ManualOrderForm
          today="2026-10-15"
          products={mockProducts}
          pickupLocations={[]}
          shopPickupEnabled={true}
          shopName="Les Saveurs"
        />,
      );

      expect(screen.queryByTestId("pickup-location-select")).toBeNull();
    });

    it("shows select on Pickup with shop as default when shop pickup is enabled, hides on Delivery, and sends selected pickupLocationId", async () => {
      const createSpy = vi.spyOn(actions, "createManualOrderAction").mockResolvedValueOnce({
        ok: true,
        data: {
          id: "ord-relay-1",
          businessId: "biz-1",
          orderNumber: 44,
          guestId: "g-1",
          serviceType: "pickup",
          channel: "phone",
          status: "CONFIRMED",
          paid: "unpaid",
          paymentPreference: "on_handover",
          paymentMethod: null,
          paidAt: null,
          requestedDate: "2026-10-15",
          requestedTime: null,
          items: [],
          totalAmount: 1050,
          createdAt: "2026-10-15T12:00:00.000Z",
          updatedAt: "2026-10-15T12:00:00.000Z",
        },
      });

      render(
        <ManualOrderForm
          today="2026-10-15"
          products={mockProducts}
          pickupLocations={[relayA, relayB]}
          shopPickupEnabled={true}
          shopName="Les Saveurs"
        />,
      );

      const select = screen.getByTestId("pickup-location-select") as HTMLSelectElement;
      expect(select.value).toBe("");
      expect(select.required).toBe(false);
      expect(select.options[0].textContent).toBe("Les Saveurs (Shop)");

      // Switch to Delivery -> select hides
      fireEvent.click(screen.getByTestId("service-type-delivery"));
      expect(screen.queryByTestId("pickup-location-select")).toBeNull();

      // Switch back to Pickup -> select reappears
      fireEvent.click(screen.getByTestId("service-type-pickup"));
      const pickupSelect = screen.getByTestId("pickup-location-select") as HTMLSelectElement;

      fillValidGuestAndItem();

      // Select relay with €2.00 fee -> total updates from €8.50 to €10.50
      fireEvent.change(pickupSelect, { target: { value: relayB.id } });
      expect(screen.getByTestId("pickup-location-selected-address").textContent).toContain(
        "12 Place Jean Jaurès, 93100",
      );
      expect(screen.getByTestId("create-order-submit-button").textContent).toContain("€10.50");

      // Open preview -> shows relay name and fee
      fireEvent.click(screen.getByTestId("create-order-submit-button"));
      expect(screen.getByTestId("preview-pickup-location").textContent).toContain(relayB.name);
      expect(screen.getByTestId("preview-pickup-fee").textContent).toContain("€2.00");

      // Submit -> sends pickupLocationId
      fireEvent.click(screen.getByTestId("confirm-create-order-button"));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            serviceType: "pickup",
            pickupLocationId: relayB.id,
          }),
        );
      });
    });

    it("requires selecting a relay when shop pickup is disabled and sends its id", async () => {
      const createSpy = vi.spyOn(actions, "createManualOrderAction").mockResolvedValueOnce({
        ok: true,
        data: {
          id: "ord-relay-2",
          businessId: "biz-1",
          orderNumber: 45,
          guestId: "g-1",
          serviceType: "pickup",
          channel: "phone",
          status: "CONFIRMED",
          paid: "unpaid",
          paymentPreference: "on_handover",
          paymentMethod: null,
          paidAt: null,
          requestedDate: "2026-10-15",
          requestedTime: null,
          items: [],
          totalAmount: 850,
          createdAt: "2026-10-15T12:00:00.000Z",
          updatedAt: "2026-10-15T12:00:00.000Z",
        },
      });

      render(
        <ManualOrderForm
          today="2026-10-15"
          products={mockProducts}
          pickupLocations={[relayA, relayB]}
          shopPickupEnabled={false}
          shopName="Les Saveurs"
        />,
      );

      const select = screen.getByTestId("pickup-location-select") as HTMLSelectElement;
      expect(select.required).toBe(true);
      expect(select.value).toBe("");
      expect(select.options[0].textContent).toContain("Choose a pickup location");

      fillValidGuestAndItem();

      // Still disabled until a relay is selected
      const previewBtn = screen.getByTestId("create-order-submit-button") as HTMLButtonElement;
      expect(previewBtn.disabled).toBe(true);

      // Select a relay -> enabled
      fireEvent.change(select, { target: { value: relayA.id } });
      expect(previewBtn.disabled).toBe(false);

      fireEvent.click(previewBtn);
      fireEvent.click(screen.getByTestId("confirm-create-order-button"));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            serviceType: "pickup",
            pickupLocationId: relayA.id,
          }),
        );
      });
    });

    it("sends null pickupLocationId when submitting a delivery order even after choosing a relay", async () => {
      const createSpy = vi.spyOn(actions, "createManualOrderAction").mockResolvedValueOnce({
        ok: true,
        data: {
          id: "ord-deliv-1",
          businessId: "biz-1",
          orderNumber: 46,
          guestId: "g-1",
          serviceType: "delivery",
          channel: "phone",
          status: "CONFIRMED",
          paid: "unpaid",
          paymentPreference: "on_handover",
          paymentMethod: null,
          paidAt: null,
          requestedDate: "2026-10-15",
          requestedTime: null,
          items: [],
          totalAmount: 850,
          createdAt: "2026-10-15T12:00:00.000Z",
          updatedAt: "2026-10-15T12:00:00.000Z",
        },
      });

      render(
        <ManualOrderForm
          today="2026-10-15"
          products={mockProducts}
          pickupLocations={[relayA]}
          shopPickupEnabled={true}
          shopName="Les Saveurs"
        />,
      );

      fillValidGuestAndItem();
      fireEvent.change(screen.getByTestId("pickup-location-select"), {
        target: { value: relayA.id },
      });

      // Switch to delivery and fill address
      fireEvent.click(screen.getByTestId("service-type-delivery"));
      fireEvent.change(screen.getByTestId("delivery-address-input"), {
        target: { value: "10 Rue de Rivoli, Paris" },
      });

      fireEvent.click(screen.getByTestId("create-order-submit-button"));
      fireEvent.click(screen.getByTestId("confirm-create-order-button"));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            serviceType: "delivery",
            pickupLocationId: null,
          }),
        );
      });
    });

    it("renders French pickup location labels", () => {
      render(
        <ManagerLocaleProvider locale="fr">
          <ManualOrderForm
            today="2026-10-15"
            products={mockProducts}
            pickupLocations={[relayA]}
            shopPickupEnabled={true}
            shopName="Les Saveurs"
          />
        </ManagerLocaleProvider>,
      );

      expect(screen.getByLabelText("Lieu de retrait")).toBeDefined();
      const select = screen.getByTestId("pickup-location-select") as HTMLSelectElement;
      expect(select.options[0].textContent).toBe("Les Saveurs (Boutique)");
    });
  });
});
