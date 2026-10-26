import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { getDictionary, summarizeCustomers } from "@/domain";
import { demoGuests } from "@/lib/repositories/mock/fixtures/guests";
import { demoOrders } from "@/lib/repositories/mock/fixtures/orders";
import { CustomerList } from "../components/customer-list";
import { CustomerDetail } from "../components/customer-detail";
import { updateCustomerAction } from "../customer-actions";

vi.mock("../customer-actions", () => ({ updateCustomerAction: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const summaries = summarizeCustomers(demoGuests, demoOrders);
const guest = demoGuests[0];
const orders = demoOrders.filter((o) => o.guestId === guest.id);

describe("customer list", () => {
  it("shows metrics and searches names and formatted national phone numbers", () => {
    render(<CustomerList customers={summaries} locale="en" dict={getDictionary().customers} />);
    expect(screen.getByRole("link", { name: /Jean Dupont/ }).getAttribute("href")).toBe(
      `/manage/customers/${guest.id}`,
    );
    expect(screen.getAllByText("Total spent").length).toBe(demoGuests.length);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "jEaN" } });
    expect(screen.getAllByRole("link")).toHaveLength(1);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "06 12 34 56 71" } });
    expect(screen.getAllByRole("link")).toHaveLength(1);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no match" } });
    expect(screen.getByRole("status").textContent).toContain("No customers match");
  });

  it("shows a distinct empty state and French copy", () => {
    render(<CustomerList customers={[]} locale="fr" dict={getDictionary("fr").customers} />);
    expect(screen.getByRole("heading", { name: "Clients" })).toBeDefined();
    expect(screen.getByRole("status").textContent).toContain("première commande");
  });

  it("shows live directory counts and the recent-order sort description", () => {
    render(<CustomerList customers={summaries} locale="en" dict={getDictionary().customers} />);
    expect(screen.getByText(`${summaries.length} customers listed`)).toBeDefined();
    expect(screen.getByText("Sorted by recent orders")).toBeDefined();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Jean" } });
    expect(screen.getByText("1 customer listed")).toBeDefined();
  });

  it("limits long lists and reveals more customers", () => {
    const customers = Array.from({ length: 21 }, (_, i) => ({
      ...summaries[0],
      guest: { ...guest, id: String(i), name: `Customer ${i}` },
    }));
    render(<CustomerList customers={customers} locale="en" dict={getDictionary().customers} />);
    expect(screen.getAllByRole("link")).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getAllByRole("link")).toHaveLength(21);
  });
});

describe("customer detail", () => {
  const renderDetail = (phone: string | null = guest.phone ?? null) =>
    render(
      <CustomerDetail
        summary={{ ...summaries[0], guest: { ...guest, phone } }}
        orders={[
          { ...orders[0], submittedName: "Alex" },
          { ...orders[1], submittedName: guest.name },
        ]}
        dict={getDictionary()}
      />,
    );

  it("links contact actions and order history, showing only mismatched submitted names", () => {
    renderDetail();
    expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe(
      `tel:${guest.phone}`,
    );
    expect(screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toBe(
      `https://wa.me/${guest.phone?.slice(1)}`,
    );
    expect(screen.getByTestId(`customer-order-${orders[0].id}`).textContent).toContain(
      "Ordered as Alex",
    );
    expect(screen.queryByText(`Ordered as ${guest.name}`)).toBeNull();
    expect(screen.getByTestId(`customer-order-${orders[0].id}`).getAttribute("href")).toBe(
      `/manage/orders/${orders[0].id}`,
    );
  });

  it("omits contact links for a guest without a phone", () => {
    renderDetail(null);
    expect(screen.queryByRole("link", { name: "Call" })).toBeNull();
    expect(screen.queryByRole("link", { name: "WhatsApp" })).toBeNull();
    expect(screen.getByText("No phone number")).toBeDefined();
  });

  it("shows history status badges, fulfillment and item quantities", () => {
    renderDetail();
    const order = screen.getByTestId(`customer-order-${orders[0].id}`);
    const dict = getDictionary();
    expect(order.querySelectorAll("[data-testid^='customer-order-status-']")).toHaveLength(1);
    expect(order.textContent).toContain(
      orders[0].serviceType === "pickup"
        ? dict.storefront.servicePickup
        : dict.storefront.serviceDelivery,
    );
    const itemCount = orders[0].items.reduce((total, item) => total + item.quantity, 0);
    expect(order.textContent).toContain(
      `${itemCount} ${itemCount === 1 ? dict.customers.item : dict.customers.items}`,
    );
    expect(screen.getByText("Newest first")).toBeDefined();
  });

  it("saves name and notes and updates the canonical name in history", async () => {
    vi.mocked(updateCustomerAction).mockResolvedValue({
      success: true,
      data: { ...guest, name: "Alex Martin", notes: "New note" },
    });
    renderDetail();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex Martin" } });
    fireEvent.change(screen.getByLabelText("Private notes"), { target: { value: "New note" } });
    await act(async () => fireEvent.submit(screen.getByTestId("customer-edit-form")));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("saved"));
    expect(updateCustomerAction).toHaveBeenCalledWith({
      id: guest.id,
      name: "Alex Martin",
      notes: "New note",
    });
    expect(screen.getByRole("heading", { name: "Alex Martin" })).toBeDefined();
    expect(screen.getByTestId("customer-order-history").textContent).toContain("Alex Martin");
  });

  it("announces server validation errors and keeps unsaved input", async () => {
    vi.mocked(updateCustomerAction).mockResolvedValue({
      success: false,
      error: "invalid",
      fieldErrors: { name: ["Invalid name"] },
    });
    renderDetail();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "A" } });
    await act(async () => fireEvent.submit(screen.getByTestId("customer-edit-form")));
    expect(screen.getByRole("alert").textContent).toContain("Check the name");
    expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("A");
  });

  it("has no automated accessibility violations", async () => {
    const { container } = renderDetail();
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
