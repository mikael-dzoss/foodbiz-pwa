import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CustomersPage from "../(authenticated)/customers/page";
import CustomerDetailPage from "../(authenticated)/customers/[id]/page";
import CustomerNotFound from "../(authenticated)/customers/not-found";
import CustomersLoading from "../(authenticated)/customers/loading";
import CustomerDetailLoading from "../(authenticated)/customers/[id]/loading";
import CustomersError from "../(authenticated)/customers/error";
import { summarizeCustomers } from "@/domain";
import { demoGuests } from "@/lib/repositories/mock/fixtures/guests";
import { demoOrders } from "@/lib/repositories/mock/fixtures/orders";

const { locale, list, detail } = vi.hoisted(() => ({
  locale: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: locale }) }));
// Exercise the real locale helper (the suite default is a stub that always answers English).
vi.mock("@/lib/i18n/manager-locale", async (importOriginal) => importOriginal());
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/features/customers/customer-data", () => ({
  listCustomers: list,
  getCustomer: detail,
}));
vi.mock("@/features/customers/customer-actions", () => ({ updateCustomerAction: vi.fn() }));
afterEach(() => {
  vi.clearAllMocks();
});

describe("customer routes", () => {
  it("renders the list using the manager's French locale preference", async () => {
    list.mockResolvedValue(summarizeCustomers(demoGuests, demoOrders));
    locale.mockReturnValue({ value: "fr" });
    render(await CustomersPage());
    expect(screen.getByRole("heading", { name: "Clients" })).toBeDefined();
  });

  it("falls back to English for an unsupported preference", async () => {
    list.mockResolvedValue([]);
    locale.mockReturnValue({ value: "unsupported" });
    render(await CustomersPage());
    expect(screen.getByRole("heading", { name: "Customers" })).toBeDefined();
  });

  it("renders scoped detail and distinguishes missing guests from infrastructure failures", async () => {
    const summary = summarizeCustomers([demoGuests[0]], demoOrders)[0];
    detail.mockResolvedValue({ summary, orders: [] });
    locale.mockReturnValue(undefined);
    render(await CustomerDetailPage({ params: Promise.resolve({ id: demoGuests[0].id }) }));
    expect(screen.getByRole("heading", { name: demoGuests[0].name })).toBeDefined();
    expect(screen.getByText("This customer has no orders yet.")).toBeDefined();
    detail.mockResolvedValueOnce(null);
    await expect(
      CustomerDetailPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    detail.mockRejectedValueOnce(new Error("Database offline"));
    await expect(
      CustomerDetailPage({ params: Promise.resolve({ id: demoGuests[0].id }) }),
    ).rejects.toThrow("Database offline");
  });

  it("offers a translated return link for missing customers", async () => {
    locale.mockReturnValue({ value: "fr" });
    render(await CustomerNotFound());
    expect(screen.getByText("Client introuvable.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Retour aux clients" }).getAttribute("href")).toBe(
      "/manage/customers",
    );
  });

  it("provides a loading state and retryable, generic load error", () => {
    render(<CustomersLoading />);
    expect(screen.getByTestId("customers-loading").getAttribute("aria-busy")).toBe("true");
    render(<CustomerDetailLoading />);
    expect(screen.getByTestId("customer-detail-loading").getAttribute("aria-busy")).toBe("true");
    const retry = vi.fn();
    render(<CustomersError retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert").textContent).toContain("Unable to load customers");
  });
});
