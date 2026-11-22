import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CheckoutPage, { generateStaticParams } from "../page";
import { CartProvider } from "@/features/storefront";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

describe("CheckoutPage", () => {
  it("exports generateStaticParams for supported locales", async () => {
    const params = await generateStaticParams();
    expect(params).toEqual([{ locale: "en" }, { locale: "fr" }]);
  });

  it("renders checkout page with empty cart notice initially", async () => {
    const page = await CheckoutPage({ params: Promise.resolve({ locale: "en" }) });
    render(<CartProvider initialItems={[]}>{page}</CartProvider>);

    expect(screen.getByText(/Your cart is empty/i)).toBeDefined();
  });

  it("renders checkout page in French when locale is fr", async () => {
    const page = await CheckoutPage({ params: Promise.resolve({ locale: "fr" }) });
    render(<CartProvider initialItems={[]}>{page}</CartProvider>);

    expect(screen.getByText(/Votre panier est vide/i)).toBeDefined();
  });
});
