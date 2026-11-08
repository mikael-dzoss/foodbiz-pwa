import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDictionary } from "@/domain/i18n";
import { ToastProvider } from "@/components/ui";
import { CartProvider, resetCartStore } from "../context/cart-context";
import { CartView } from "../components/cart-view";

const enDict = getDictionary("en").storefront;

describe("CartView", () => {
  beforeEach(() => {
    resetCartStore();
  });

  afterEach(() => {
    cleanup();
    resetCartStore();
  });

  it("renders empty cart state when no items are present", () => {
    render(
      <CartProvider initialItems={[]}>
        <CartView locale="en" dict={enDict} />
      </CartProvider>,
    );

    expect(screen.getByText(enDict.emptyCartTitle)).toBeDefined();
    expect(screen.getByText(enDict.returnToCatalog)).toBeDefined();
    expect(screen.queryByTestId("cart-items-list")).toBeNull();
  });

  it("renders cart items, quantities, and subtotal", () => {
    const initialItems = [
      {
        productId: "p1",
        name: "Pain au Chocolat",
        price: 220,
        quantity: 2,
        maxStock: 5,
        imageUrl: null,
      },
      {
        productId: "p2",
        name: "Baguette Tradition",
        price: 140,
        quantity: 1,
        maxStock: 10,
        imageUrl: null,
      },
    ];

    render(
      <CartProvider initialItems={initialItems}>
        <CartView locale="en" dict={enDict} minOrderAmount={500} />
      </CartProvider>,
    );

    expect(screen.getByText("Pain au Chocolat")).toBeDefined();
    expect(screen.getByText("Baguette Tradition")).toBeDefined();
    expect(screen.getByTestId("cart-count-badge").textContent).toContain("3");
    // Subtotal: 2 * 220 + 140 = 580 cents = €5.80 >= 500
    expect(screen.getByText(enDict.minimumOrderReached)).toBeDefined();

    // #237: actions bar is in-flow sticky, never a fixed overlay over the footer
    const bar = screen.getByTestId("cart-action-bar");
    expect(bar.className).toContain("sticky");
    expect(bar.className).not.toMatch(/\bfixed\b/);
    expect(bar.contains(screen.getByTestId("proceed-checkout-button"))).toBe(true);
  });

  it("displays minimum order warning when subtotal is below minimum threshold", () => {
    const initialItems = [
      {
        productId: "p1",
        name: "Croissant",
        price: 200,
        quantity: 1,
        maxStock: 5,
        imageUrl: null,
      },
    ];

    render(
      <CartProvider initialItems={initialItems}>
        <CartView locale="en" dict={enDict} minOrderAmount={1000} />
      </CartProvider>,
    );

    expect(screen.getByTestId("minimum-order-banner")).toBeDefined();
    expect(screen.getByText(/Add €8.00 more fresh items/i)).toBeDefined();

    const proceedButton = screen.getByTestId("proceed-checkout-button") as HTMLButtonElement;
    expect(proceedButton.disabled).toBe(true);
  });

  it("enables proceed button when subtotal satisfies minimum order threshold", () => {
    const initialItems = [
      {
        productId: "p1",
        name: "Croissant",
        price: 200,
        quantity: 5,
        maxStock: 10,
        imageUrl: null,
      },
    ];

    render(
      <CartProvider initialItems={initialItems}>
        <CartView locale="en" dict={enDict} minOrderAmount={1000} />
      </CartProvider>,
    );

    expect(screen.getByText(enDict.minimumOrderReached)).toBeDefined();
    const proceedLink = screen.getByTestId("proceed-checkout-button");
    expect(proceedLink.tagName).toBe("A");
    expect(proceedLink.getAttribute("href")).toBe("/en/checkout");
  });

  it("allows incrementing, decrementing, and removing items", () => {
    const initialItems = [
      {
        productId: "p1",
        name: "Croissant",
        price: 200,
        quantity: 2,
        maxStock: 3,
        imageUrl: null,
      },
    ];

    render(
      <CartProvider initialItems={initialItems}>
        <CartView locale="en" dict={enDict} minOrderAmount={0} />
      </CartProvider>,
    );

    // Increment
    const incBtn = screen.getByLabelText("Increase quantity");
    fireEvent.click(incBtn);
    expect(screen.getByText(/Max stock reached \(3\)/i)).toBeDefined();

    // Increment again should be blocked by max stock
    fireEvent.click(incBtn);
    expect(screen.getByText(/Max stock reached \(3\)/i)).toBeDefined();

    // Decrement
    const decBtn = screen.getByLabelText("Decrease quantity");
    fireEvent.click(decBtn);
    expect(screen.queryByText(/Max stock reached/i)).toBeNull();

    // Remove item
    const removeBtn = screen.getByLabelText("Remove Croissant");
    fireEvent.click(removeBtn);
    expect(screen.getByText(enDict.emptyCartTitle)).toBeDefined();
  });

  it("clears cart when Clear button is clicked", () => {
    const initialItems = [
      {
        productId: "p1",
        name: "Croissant",
        price: 200,
        quantity: 1,
        maxStock: 5,
        imageUrl: null,
      },
    ];

    render(
      <CartProvider initialItems={initialItems}>
        <CartView locale="en" dict={enDict} />
      </CartProvider>,
    );

    const clearBtn = screen.getByTestId("clear-cart-top-button");
    fireEvent.click(clearBtn);
    expect(screen.getByText(enDict.emptyCartTitle)).toBeDefined();
  });

  it("displays Soon badge for voucher and shows toast notice when clicking Have a voucher (#85)", () => {
    const initialItems = [
      {
        productId: "p1",
        name: "Croissant",
        price: 200,
        quantity: 1,
        maxStock: 5,
        imageUrl: null,
      },
    ];

    render(
      <ToastProvider>
        <CartProvider initialItems={initialItems}>
          <CartView locale="en" dict={enDict} />
        </CartProvider>
      </ToastProvider>,
    );

    // Soon badge
    const badge = screen.getByTestId("discount-soon-badge");
    expect(badge.textContent).toBe(enDict.soon);

    // Toast on clicking Have a voucher
    const voucherBtn = screen.getByTestId("have-voucher-button");
    fireEvent.click(voucherBtn);

    expect(screen.getByText(enDict.voucherUnavailableNotice)).toBeDefined();
  });

  it("unfolds kitchen/packing note textarea when tapped and updates note in cart (#85, #86)", () => {
    const initialItems = [
      {
        productId: "p1",
        name: "Croissant",
        price: 200,
        quantity: 1,
        maxStock: 5,
        imageUrl: null,
      },
    ];

    render(
      <ToastProvider>
        <CartProvider initialItems={initialItems}>
          <CartView locale="en" dict={enDict} />
        </CartProvider>
      </ToastProvider>,
    );

    // Initially collapsed
    expect(screen.queryByTestId("cart-kitchen-note-input")).toBeNull();

    // Toggle disclosure
    const toggleBtn = screen.getByTestId("toggle-kitchen-note-btn");
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggleBtn);

    // Unfolded
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
    const textarea = screen.getByTestId("cart-kitchen-note-input") as HTMLTextAreaElement;
    expect(textarea).toBeDefined();

    // Type notes
    fireEvent.change(textarea, { target: { value: "Please pack croissants separately" } });
    expect(textarea.value).toBe("Please pack croissants separately");
  });
});
