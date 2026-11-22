import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CartProvider, useCart, resetCartStore } from "../context/cart-context";
import { DEMO_PRODUCT } from "@/lib/repositories/mock/fixtures";
import type { Product } from "@/domain/product";

const mockProduct: Product = {
  id: "prod-1",
  businessId: "biz-1",
  categoryId: "cat-1",
  name: DEMO_PRODUCT.beignetsSouffles.name,
  description: DEMO_PRODUCT.beignetsSouffles.description,
  price: 250,
  unitCost: 100,
  stock: 5,
  visible: true,
  allergens: [],
  suggestAddOns: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const mockOutOfStockProduct: Product = {
  ...mockProduct,
  id: "prod-out",
  name: "Sold Out Dish",
  stock: 0,
};

function TestCartConsumer() {
  const {
    items,
    totalCount,
    totalAmountInCents,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    syncPrices,
    notes,
    setNotes,
  } = useCart();

  return (
    <div>
      <div data-testid="total-count">{totalCount}</div>
      <div data-testid="total-amount">{totalAmountInCents}</div>
      <div data-testid="item-count">{items.length}</div>
      <div data-testid="cart-notes">{notes}</div>
      <ul>
        {items.map((i) => (
          <li key={i.productId} data-testid={`item-${i.productId}`}>
            <span>{i.name}</span> - <span>qty: {i.quantity}</span> -{" "}
            <span data-testid={`price-${i.productId}`}>{i.price}</span>
            <button
              onClick={() => updateQuantity(i.productId, i.quantity + 1)}
              data-testid={`inc-${i.productId}`}
            >
              +
            </button>
            <button
              onClick={() => updateQuantity(i.productId, i.quantity - 1)}
              data-testid={`dec-${i.productId}`}
            >
              -
            </button>
            <button onClick={() => removeItem(i.productId)} data-testid={`remove-${i.productId}`}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button onClick={() => addItem(mockProduct, 1)} data-testid="add-btn">
        Add Product
      </button>
      <button onClick={() => addItem(mockProduct, 10)} data-testid="add-overstock-btn">
        Add Overstock
      </button>
      <button onClick={() => addItem(mockOutOfStockProduct, 1)} data-testid="add-out-btn">
        Add Out of Stock
      </button>
      <button
        onClick={() => syncPrices([{ id: "prod-1", price: 300, stock: 2 }])}
        data-testid="sync-prices-btn"
      >
        Sync Prices
      </button>
      <button onClick={() => setNotes("Extra crispy packaging")} data-testid="set-notes-btn">
        Set Notes
      </button>
      <button onClick={clearCart} data-testid="clear-btn">
        Clear
      </button>
    </div>
  );
}

describe("CartContext (#81, #82)", () => {
  beforeEach(() => {
    resetCartStore();
  });

  afterEach(() => {
    resetCartStore();
  });

  it("initializes with an empty cart", () => {
    render(
      <CartProvider>
        <TestCartConsumer />
      </CartProvider>,
    );

    expect(screen.getByTestId("total-count").textContent).toBe("0");
    expect(screen.getByTestId("total-amount").textContent).toBe("0");
    expect(screen.getByTestId("item-count").textContent).toBe("0");
  });

  it("adds a product with given quantity and updates total and subtotal", () => {
    render(
      <CartProvider>
        <TestCartConsumer />
      </CartProvider>,
    );

    fireEvent.click(screen.getByTestId("add-btn"));

    expect(screen.getByTestId("total-count").textContent).toBe("1");
    expect(screen.getByTestId("total-amount").textContent).toBe("250");
    expect(screen.getByTestId("item-prod-1")).toBeDefined();
  });

  it("caps added quantity at product available stock", () => {
    render(
      <CartProvider>
        <TestCartConsumer />
      </CartProvider>,
    );

    // mockProduct has stock: 5
    fireEvent.click(screen.getByTestId("add-overstock-btn"));

    expect(screen.getByTestId("total-count").textContent).toBe("5");
    expect(screen.getByTestId("total-amount").textContent).toBe(String(5 * 250));
  });

  it("refuses to add out-of-stock items (stock <= 0)", () => {
    render(
      <CartProvider>
        <TestCartConsumer />
      </CartProvider>,
    );

    fireEvent.click(screen.getByTestId("add-out-btn"));

    expect(screen.getByTestId("total-count").textContent).toBe("0");
    expect(screen.getByTestId("item-count").textContent).toBe("0");
  });

  it("updates quantity with stepper and removes item when decreased to 0", () => {
    render(
      <CartProvider>
        <TestCartConsumer />
      </CartProvider>,
    );

    fireEvent.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("total-count").textContent).toBe("1");

    // Increment
    fireEvent.click(screen.getByTestId("inc-prod-1"));
    expect(screen.getByTestId("total-count").textContent).toBe("2");
    expect(screen.getByTestId("total-amount").textContent).toBe("500");

    // Decrement once
    fireEvent.click(screen.getByTestId("dec-prod-1"));
    expect(screen.getByTestId("total-count").textContent).toBe("1");

    // Decrement to 0 -> removes item
    fireEvent.click(screen.getByTestId("dec-prod-1"));
    expect(screen.getByTestId("total-count").textContent).toBe("0");
    expect(screen.getByTestId("item-count").textContent).toBe("0");
  });

  it("removes item explicitly and clears cart", () => {
    render(
      <CartProvider>
        <TestCartConsumer />
      </CartProvider>,
    );

    fireEvent.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("item-count").textContent).toBe("1");

    fireEvent.click(screen.getByTestId("remove-prod-1"));
    expect(screen.getByTestId("item-count").textContent).toBe("0");

    fireEvent.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("item-count").textContent).toBe("1");

    fireEvent.click(screen.getByTestId("clear-btn"));
    expect(screen.getByTestId("item-count").textContent).toBe("0");
  });

  it("syncs fresh prices and caps quantities according to updated server stock (#85)", () => {
    render(
      <CartProvider>
        <TestCartConsumer />
      </CartProvider>,
    );

    // Add 5 items at price 250
    fireEvent.click(screen.getByTestId("add-overstock-btn"));
    expect(screen.getByTestId("total-count").textContent).toBe("5");
    expect(screen.getByTestId("total-amount").textContent).toBe("1250");
    expect(screen.getByTestId("price-prod-1").textContent).toBe("250");

    // Sync prices: updated price 300, stock reduced to 2
    fireEvent.click(screen.getByTestId("sync-prices-btn"));
    expect(screen.getByTestId("price-prod-1").textContent).toBe("300");
    expect(screen.getByTestId("total-count").textContent).toBe("2");
    expect(screen.getByTestId("total-amount").textContent).toBe("600");
  });

  it("stores and clears customer kitchen/packing notes (#85, #86)", () => {
    render(
      <CartProvider>
        <TestCartConsumer />
      </CartProvider>,
    );

    expect(screen.getByTestId("cart-notes").textContent).toBe("");

    fireEvent.click(screen.getByTestId("set-notes-btn"));
    expect(screen.getByTestId("cart-notes").textContent).toBe("Extra crispy packaging");

    fireEvent.click(screen.getByTestId("clear-btn"));
    expect(screen.getByTestId("cart-notes").textContent).toBe("");
  });
});
