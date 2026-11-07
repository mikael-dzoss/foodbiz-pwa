import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enDictionary, frDictionary } from "@/domain/i18n";
import { ToastProvider } from "@/components/ui";
import { StorefrontMenuDrawer } from "../components/storefront-menu-drawer";
import { CartProvider, resetCartStore } from "../context/cart-context";

function renderDrawer(locale: "en" | "fr" = "en") {
  const dict = locale === "en" ? enDictionary.storefront : frDictionary.storefront;
  return render(
    <ToastProvider>
      <CartProvider
        initialItems={[
          { productId: "p1", name: "Baguette", price: 130, quantity: 2, maxStock: 10 },
        ]}
      >
        <StorefrontMenuDrawer locale={locale} dict={dict} businessName="La Boulangerie" />
      </CartProvider>
    </ToastProvider>,
  );
}

beforeEach(() => resetCartStore());
afterEach(() => {
  cleanup();
  resetCartStore();
  vi.unstubAllGlobals();
});

describe("StorefrontMenuDrawer (#231)", () => {
  it("opens a left drawer with the storefront shortcuts", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const drawer = screen.getByTestId("storefront-menu-drawer");
    expect(screen.getByRole("dialog", { name: "La Boulangerie" })).toBe(drawer);
    expect(screen.getByTestId("menu-track-order").getAttribute("href")).toBe("/en/track");
    expect(screen.getByTestId("menu-view-cart").getAttribute("href")).toBe("/en/cart");
    expect(screen.getByTestId("menu-cart-count").textContent).toContain("2");
    expect(screen.getByTestId("menu-about").textContent).toContain("About La Boulangerie");
    expect(screen.getByTestId("menu-about").getAttribute("href")).toBe("/en/info");

    const history = screen.getByTestId("menu-order-history") as HTMLButtonElement;
    expect(history.disabled).toBe(true);
    expect(history.getAttribute("aria-label")).toBe("Order history (Soon)");
  });

  it("closes when an item is selected", async () => {
    renderDrawer("fr");
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" }));
    fireEvent.click(screen.getByTestId("menu-track-order"));
    await waitFor(() => expect(screen.queryByTestId("storefront-menu-drawer")).toBeNull());
  });

  it("shares with the Web Share API when available", async () => {
    const share = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByTestId("menu-share"));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: "La Boulangerie",
        url: `${window.location.origin}/en`,
      }),
    );
  });

  it("copies the shop link and confirms with a toast otherwise", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByTestId("menu-share"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/en`));
    expect(await screen.findByText(enDictionary.storefront.linkCopied)).toBeDefined();
  });
});
