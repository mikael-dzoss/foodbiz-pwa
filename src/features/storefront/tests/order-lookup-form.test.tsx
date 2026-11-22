import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { enDictionary, frDictionary } from "@/domain/i18n";
import type { OrderLookupState } from "@/domain/order-lookup";
import { OrderLookupForm } from "../components/order-lookup-form";

describe("OrderLookupForm (#230)", () => {
  it("renders labelled fields and shows a generic error while keeping the typed values", async () => {
    const action = vi.fn(
      async (_prev: OrderLookupState, data: FormData): Promise<OrderLookupState> => ({
        status: "error",
        code: "NOT_FOUND",
        values: {
          phone: String(data.get("phone")),
          orderNumber: String(data.get("orderNumber")),
        },
      }),
    );
    render(<OrderLookupForm locale="en" dict={enDictionary.storefront} action={action} />);

    expect(screen.getByRole("heading", { level: 1, name: "Track your order" })).toBeDefined();
    const phone = screen.getByLabelText("Phone number") as HTMLInputElement;
    const orderNumber = screen.getByLabelText("Order number") as HTMLInputElement;
    expect(phone.type).toBe("tel");
    expect(phone.autocomplete).toBe("tel");
    expect(orderNumber.inputMode).toBe("numeric");

    fireEvent.change(phone, { target: { value: "0612345671" } });
    fireEvent.change(orderNumber, { target: { value: "35" } });
    fireEvent.click(screen.getByTestId("order-lookup-submit"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(enDictionary.storefront.trackErrorNotFound);
    expect(action).toHaveBeenCalledTimes(1);
    const submitted = action.mock.calls[0][1];
    expect(submitted.get("locale")).toBe("en");
    expect(submitted.get("website")).toBe("");
    await waitFor(() =>
      expect((screen.getByLabelText("Phone number") as HTMLInputElement).value).toBe("0612345671"),
    );
  });

  it.each([
    ["RATE_LIMITED", frDictionary.storefront.trackErrorRateLimited],
    ["INVALID", frDictionary.storefront.trackErrorInvalid],
  ] as const)("maps %s to its French message", async (code, message) => {
    const action = vi.fn(async (): Promise<OrderLookupState> => ({
      status: "error",
      code,
      values: { phone: "", orderNumber: "" },
    }));
    render(<OrderLookupForm locale="fr" dict={frDictionary.storefront} action={action} />);
    fireEvent.click(screen.getByTestId("order-lookup-submit"));
    expect((await screen.findByRole("alert")).textContent).toBe(message);
  });
});
