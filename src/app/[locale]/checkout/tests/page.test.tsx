import { Suspense, isValidElement, type ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CheckoutPage, { generateStaticParams } from "../page";
import * as storefront from "@/features/storefront";
import { CartProvider, resetCartStore } from "@/features/storefront";
import { getDictionary } from "@/domain/i18n";

const mockConnection = vi.fn(async () => {});

vi.mock("next/server", () => ({
  connection: () => mockConnection(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/en/checkout",
}));

async function resolveSuspenseContent(pageElement: ReactElement): Promise<ReactElement> {
  expect(pageElement.type).toBe(Suspense);
  const { children } = pageElement.props as { children: ReactElement };
  expect(isValidElement(children)).toBe(true);
  const asyncChild = children.type as (props: unknown) => Promise<ReactElement>;
  return asyncChild(children.props);
}

const sampleCartItems = [
  {
    productId: "p1",
    name: "Poulet braisé",
    price: 650,
    quantity: 1,
    maxStock: 5,
    imageUrl: null,
  },
];

describe("CheckoutPage", () => {
  beforeEach(() => {
    mockConnection.mockClear();
    resetCartStore();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetCartStore();
    localStorage.clear();
  });

  it("exports generateStaticParams for supported locales", async () => {
    const params = await generateStaticParams();
    expect(params).toEqual([{ locale: "en" }, { locale: "fr" }]);
  });

  it("renders checkout page with empty cart notice initially", async () => {
    const page = await CheckoutPage({ params: Promise.resolve({ locale: "en" }) });
    // connection() must only run inside the Suspense child, not before Suspense
    expect(mockConnection).not.toHaveBeenCalled();

    const content = await resolveSuspenseContent(page);
    expect(mockConnection).toHaveBeenCalledTimes(1);

    render(<CartProvider initialItems={[]}>{content}</CartProvider>);

    expect(screen.getByText(/Your cart is empty/i)).toBeDefined();
  });

  it("renders checkout page in French when locale is fr", async () => {
    const page = await CheckoutPage({ params: Promise.resolve({ locale: "fr" }) });
    const content = await resolveSuspenseContent(page);
    render(<CartProvider initialItems={[]}>{content}</CartProvider>);

    expect(screen.getByText(/Votre panier est vide/i)).toBeDefined();
  });

  it("evaluates operating status at request time after connection(): forces scheduling when outside opening hours (#350)", async () => {
    vi.useFakeTimers();
    // 23:00 Paris time (22:00 UTC in winter) is outside demo opening hours ("08:00 - 18:00")
    vi.setSystemTime(new Date("2026-11-26T22:00:00Z"));

    const page = await CheckoutPage({ params: Promise.resolve({ locale: "en" }) });
    const content = await resolveSuspenseContent(page);
    expect(mockConnection).toHaveBeenCalledTimes(1);

    render(<CartProvider initialItems={sampleCartItems}>{content}</CartProvider>);

    expect(screen.queryByTestId("timing-asap-option")).toBeNull();
    expect(screen.getByTestId("scheduled-timing-inputs")).toBeDefined();
    expect(screen.getByTestId("checkout-closed-schedule-notice").textContent).toBe(
      getDictionary("en").storefront.checkoutClosedScheduleNotice,
    );
  });

  it("evaluates operating status at request time after connection(): keeps ASAP default during opening hours (#350)", async () => {
    vi.useFakeTimers();
    // 12:00 Paris time (11:00 UTC in winter) is inside demo opening hours
    vi.setSystemTime(new Date("2026-11-26T11:00:00Z"));

    const page = await CheckoutPage({ params: Promise.resolve({ locale: "en" }) });
    const content = await resolveSuspenseContent(page);
    expect(mockConnection).toHaveBeenCalledTimes(1);

    render(<CartProvider initialItems={sampleCartItems}>{content}</CartProvider>);

    expect(screen.getByTestId("timing-asap-option")).toBeDefined();
    expect(screen.queryByTestId("scheduled-timing-inputs")).toBeNull();
    expect(screen.queryByTestId("checkout-closed-schedule-notice")).toBeNull();
  });

  it("ignores stale cached catalog.isOpen and uses request-time clock after connection() (#350)", async () => {
    vi.useFakeTimers();
    // 12:00 Paris -> get real catalog with isOpen: true as if cached during open hours
    vi.setSystemTime(new Date("2026-11-26T11:00:00Z"));
    const staleOpenCatalog = await storefront.getStorefrontCatalog();
    expect(staleOpenCatalog.isOpen).toBe(true);

    vi.spyOn(storefront, "getStorefrontCatalog").mockResolvedValue(staleOpenCatalog);

    // Advance request clock to 23:00 Paris (closed)
    vi.setSystemTime(new Date("2026-11-26T22:00:00Z"));

    const page = await CheckoutPage({ params: Promise.resolve({ locale: "en" }) });
    const content = await resolveSuspenseContent(page);
    expect(mockConnection).toHaveBeenCalledTimes(1);

    render(<CartProvider initialItems={sampleCartItems}>{content}</CartProvider>);

    expect(screen.queryByTestId("timing-asap-option")).toBeNull();
    expect(screen.getByTestId("scheduled-timing-inputs")).toBeDefined();
    expect(screen.getByTestId("checkout-closed-schedule-notice")).toBeDefined();
  });
});
