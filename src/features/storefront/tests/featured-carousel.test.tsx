import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeaturedCarousel } from "../components/featured-carousel";
import { CartProvider, resetCartStore } from "../context/cart-context";
import { enDictionary, frDictionary } from "@/domain/i18n";
import { demoProducts } from "@/lib/repositories/mock/fixtures";

const products = demoProducts
  .slice(0, 4)
  .map((p, i) => ({ ...p, stock: 1, imageUrl: i === 0 ? null : p.imageUrl }));
afterEach(() => {
  resetCartStore();
  vi.useRealTimers();
});

describe("FeaturedCarousel (#204)", () => {
  it.each(["en", "fr"] as const)(
    "renders %s ordered cards, top-three badges, square images, links and a keyboard-scrollable region",
    (locale) => {
      const dict = locale === "en" ? enDictionary.storefront : frDictionary.storefront;
      render(
        <CartProvider>
          <FeaturedCarousel products={products} locale={locale} dict={dict} />
        </CartProvider>,
      );
      const carousel = screen.getByRole("region", { name: dict.featuredItems });
      expect(carousel.getAttribute("tabindex")).toBe("0");
      expect(carousel.className).toContain("overflow-x-auto");
      expect(carousel.className).toContain("snap-x");
      const cards = within(carousel).getAllByRole("article");
      expect(cards.map((card) => within(card).getByRole("link").textContent)).toEqual(
        products.map((p) => p.name),
      );
      cards.forEach((card, index) => {
        expect(card.className).toContain("w-40");
        expect(within(card).getByRole("link").getAttribute("href")).toBe(
          `/${locale}/p/${products[index].id}`,
        );
        if (index < 3)
          expect(within(card).getByText(`#${index + 1} ${dict.mostOrdered}`)).toBeDefined();
        else expect(within(card).queryByText(new RegExp(dict.mostOrdered))).toBeNull();
        const button = within(card).getByRole("button");
        expect(button.className).toContain("min-h-11");
        expect(button.getAttribute("data-size")).toBe("regular");
        expect(button.className).toContain("min-w-11");
      });
      expect(screen.getByTestId(`featured-image-placeholder-${products[0].id}`)).toBeDefined();
      expect(within(carousel).getAllByRole("img")).toHaveLength(3);
    },
  );
  it("adds with feedback and shares stock guards with catalog rows", () => {
    vi.useFakeTimers();
    render(
      <CartProvider>
        <FeaturedCarousel products={[products[0]]} locale="en" dict={enDictionary.storefront} />
      </CartProvider>,
    );
    const button = screen.getByRole("button", { name: `Add to cart: ${products[0].name}` });
    fireEvent.click(button);
    expect(button).toHaveProperty("disabled", true);
    expect(screen.getByText(enDictionary.storefront.addedToCart)).toBeDefined();
    act(() => vi.advanceTimersByTime(1300));
    expect(screen.queryByText(enDictionary.storefront.addedToCart)).toBeNull();
  });
  it("disables add buttons when not accepting orders", () => {
    render(
      <CartProvider>
        <FeaturedCarousel
          products={[products[0]]}
          locale="en"
          dict={enDictionary.storefront}
          disabled
        />
      </CartProvider>,
    );
    expect(screen.getByRole("button")).toHaveProperty("disabled", true);
  });
  it("renders nothing for an empty featured list", () => {
    const { container } = render(
      <CartProvider>
        <FeaturedCarousel products={[]} locale="en" dict={enDictionary.storefront} />
      </CartProvider>,
    );
    expect(container.firstChild).toBeNull();
  });
});
