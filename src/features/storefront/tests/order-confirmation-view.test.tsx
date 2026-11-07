import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/domain/i18n";
import { publicOrderSchema } from "@/domain/order";
import { createDefaultFixtures } from "@/lib/repositories/mock/fixtures";
import { formatMoney } from "@/domain/formatting";
import { OrderConfirmationView } from "../components/order-confirmation-view";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

for (const locale of ["en", "fr"] as const) {
  describe(`${locale} confirmation`, () => {
    const dict = getDictionary(locale);
    const fixtures = createDefaultFixtures();
    const order = publicOrderSchema.parse({ ...fixtures.orders[0], paid: "unpaid", status: "NEW" });
    const props = {
      order,
      locale,
      dict,
      token: "secret-link",
      businessName: fixtures.business.name,
    };

    it.each(["revolut", "wero"] as const)(
      "shows exact %s recipient, amount and reference",
      (method) => {
        render(
          <OrderConfirmationView
            {...props}
            order={{ ...order, paymentPreference: method }}
            settings={{
              ...fixtures.settings,
              revolutRevtag: "@recipient",
              weroIdentifier: "pay@example.test",
            }}
          />,
        );
        expect(screen.getByTestId("confirmation-payment").textContent).toContain(
          method === "revolut" ? "@recipient" : "pay@example.test",
        );
        expect(screen.getByTestId("confirmation-payment").textContent).toContain(
          formatMoney(order.totalAmount, locale),
        );
        expect(screen.getByTestId("confirmation-payment").textContent).toContain(
          `#${order.orderNumber}`,
        );
        // #234: emphasised reference instruction, no handover note, italic disclaimer
        expect(screen.getByTestId("confirmation-payment-reference").textContent).toBe(
          dict.orderConfirmation.paymentReference.replace("{reference}", `#${order.orderNumber}`),
        );
        expect(screen.queryByTestId("confirmation-handover-prepare")).toBeNull();
        const disclaimer = screen.getByTestId("confirmation-payment-disclaimer");
        expect(disclaimer.textContent?.startsWith("*")).toBe(true);
        expect(disclaimer.className).toContain("italic");
        expect(
          screen.getByRole("link", { name: dict.storefront.trackOrder }).getAttribute("href"),
        ).toBe(`/${locale}/order/secret-link`);
        expect(screen.getByText(order.items[0].productName)).toBeDefined();
      },
    );

    it("shows handover instructions without exposing payment identifiers", () => {
      render(
        <OrderConfirmationView
          {...props}
          order={{ ...order, paymentPreference: "on_handover" }}
          settings={{ ...fixtures.settings, revolutRevtag: "@hidden" }}
        />,
      );
      expect(screen.getByText(dict.orderConfirmation.handover)).toBeDefined();
      expect(screen.queryByText("@hidden")).toBeNull();
      expect(screen.getByTestId("confirmation-handover-prepare").textContent).toBe(
        dict.orderConfirmation.handoverPrepare,
      );
      expect(screen.queryByTestId("confirmation-payment-reference")).toBeNull();
    });

    it("explains missing configuration instead of inventing a recipient", () => {
      render(
        <OrderConfirmationView
          {...props}
          order={{ ...order, paymentPreference: "revolut" }}
          settings={null}
        />,
      );
      expect(screen.getByText(dict.orderConfirmation.unavailable)).toBeDefined();
    });

    it.each(["paid", "refunded"] as const)("does not request another payment when %s", (paid) => {
      render(
        <OrderConfirmationView
          {...props}
          order={{ ...order, paid }}
          settings={fixtures.settings}
        />,
      );
      expect(screen.queryByRole("button", { name: dict.orderConfirmation.copy })).toBeNull();
      expect(screen.queryByTestId("confirmation-payment-disclaimer")).toBeNull();
    });

    it("does not request payment for a cancelled order", () => {
      render(
        <OrderConfirmationView
          {...props}
          order={{ ...order, status: "CANCELLED" }}
          settings={fixtures.settings}
        />,
      );
      expect(screen.queryByTestId("confirmation-payment-disclaimer")).toBeNull();
      expect(screen.getByText(dict.orderTracking.statuses.CANCELLED)).toBeDefined();
    });

    it("copies only the recipient and announces clipboard failures", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      render(
        <OrderConfirmationView
          {...props}
          order={{ ...order, paymentPreference: "revolut" }}
          settings={{ ...fixtures.settings, revolutRevtag: "@recipient" }}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: dict.orderConfirmation.copy }));
      await waitFor(() =>
        expect(screen.getByRole("status").textContent).toBe(dict.orderConfirmation.copied),
      );
      expect(writeText).toHaveBeenCalledWith("@recipient");
      writeText.mockRejectedValueOnce(new Error("Clipboard denied"));
      fireEvent.click(screen.getByRole("button", { name: dict.orderConfirmation.copy }));
      await waitFor(() =>
        expect(screen.getByRole("status").textContent).toBe(dict.orderConfirmation.copyFailed),
      );
    });
  });
}
