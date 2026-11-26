import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/domain/i18n";
import { publicOrderSchema } from "@/domain/order";
import { createDefaultFixtures } from "@/lib/repositories/mock/fixtures";
import { formatMoney } from "@/domain/formatting";
import { OrderConfirmationView } from "../components/order-confirmation-view";

afterEach(() => {
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
      businessAddress: fixtures.business.address,
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

    it("shows handover instructions matching enabled cash/card methods without exposing payment identifiers", () => {
      const { rerender } = render(
        <OrderConfirmationView
          {...props}
          order={{ ...order, paymentPreference: "on_handover" }}
          settings={{
            ...fixtures.settings,
            revolutRevtag: "@hidden",
            paymentMethods: { cash: true, card: false, revolut: true, wero: true },
          }}
        />,
      );
      expect(screen.getByText(dict.orderConfirmation.handoverCash)).toBeDefined();
      expect(screen.queryByText("@hidden")).toBeNull();
      expect(screen.getByTestId("confirmation-handover-prepare").textContent).toBe(
        dict.orderConfirmation.handoverPrepare,
      );
      expect(screen.queryByTestId("confirmation-payment-reference")).toBeNull();

      rerender(
        <OrderConfirmationView
          {...props}
          order={{ ...order, paymentPreference: "on_handover" }}
          settings={{
            ...fixtures.settings,
            paymentMethods: { cash: false, card: true, revolut: true, wero: true },
          }}
        />,
      );
      expect(screen.getByText(dict.orderConfirmation.handoverCard)).toBeDefined();
      expect(screen.getByTestId("confirmation-handover-prepare").textContent).toBe(
        dict.orderConfirmation.handoverPrepareCard,
      );

      rerender(
        <OrderConfirmationView
          {...props}
          order={{ ...order, paymentPreference: "on_handover" }}
          settings={{
            ...fixtures.settings,
            paymentMethods: { cash: true, card: true, revolut: true, wero: true },
          }}
        />,
      );
      expect(screen.getByText(dict.orderConfirmation.handoverCashCard)).toBeDefined();
      expect(screen.getByTestId("confirmation-handover-prepare").textContent).toBe(
        dict.orderConfirmation.handoverPrepare,
      );
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

    it("shows the delivery address for delivery orders and hides it for pickup (#352)", () => {
      const deliveryAddress = "42 Avenue des Champs-Élysées, 75008 Paris";
      const { rerender } = render(
        <OrderConfirmationView
          {...props}
          order={{ ...order, serviceType: "delivery", deliveryAddress }}
          settings={fixtures.settings}
        />,
      );

      const addressSection = screen.getByTestId("confirmation-delivery-address");
      expect(
        screen.getByRole("heading", { name: dict.orderTracking.fulfillmentDetails }),
      ).toBeDefined();
      expect(addressSection.querySelector("dl dt")?.textContent).toBe(
        locale === "fr" ? "Livraison à" : "Delivery to",
      );
      expect(addressSection.querySelector("dl dd")?.textContent).toBe(deliveryAddress);

      rerender(
        <OrderConfirmationView
          {...props}
          order={{ ...order, serviceType: "pickup", deliveryAddress }}
          settings={fixtures.settings}
        />,
      );
      expect(screen.queryByTestId("confirmation-delivery-address")).toBeNull();
      expect(screen.queryByText(deliveryAddress)).toBeNull();

      rerender(
        <OrderConfirmationView
          {...props}
          order={{ ...order, serviceType: "delivery", deliveryAddress: null }}
          settings={fixtures.settings}
        />,
      );
      expect(screen.queryByTestId("confirmation-delivery-address")).toBeNull();
    });

    it("shows Collect at block with relay or shop fallback and encoded Directions link only for pickup (#387)", () => {
      const relayAddress = "12 Place Jean Jaurès, 93100 Montreuil";
      const { rerender } = render(
        <OrderConfirmationView
          {...props}
          order={{
            ...order,
            serviceType: "pickup",
            pickupLocation: { name: "Marché de Montreuil", address: relayAddress },
          }}
          settings={fixtures.settings}
        />,
      );

      const pickupSection = screen.getByTestId("confirmation-pickup-location");
      expect(pickupSection.querySelector("dl dt")?.textContent).toBe(dict.orderTracking.collectAt);
      expect(screen.getByTestId("confirmation-pickup-name").textContent).toBe(
        "Marché de Montreuil",
      );
      expect(screen.getByTestId("confirmation-pickup-address").textContent).toBe(relayAddress);
      const directionsLink = screen.getByTestId("confirmation-directions-link");
      expect(directionsLink.getAttribute("href")).toBe(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(relayAddress)}`,
      );
      expect(directionsLink.getAttribute("target")).toBe("_blank");
      expect(directionsLink.getAttribute("rel")).toBe("noopener noreferrer");

      // Shop fallback when pickupLocation name is null (tracking RPC shop pickup)
      rerender(
        <OrderConfirmationView
          {...props}
          order={{
            ...order,
            serviceType: "pickup",
            pickupLocation: { name: null, address: fixtures.business.address ?? null },
          }}
          settings={fixtures.settings}
        />,
      );
      expect(screen.getByTestId("confirmation-pickup-name").textContent).toBe(
        fixtures.business.name,
      );
      expect(screen.getByTestId("confirmation-pickup-address").textContent).toBe(
        fixtures.business.address,
      );
      expect(screen.getByTestId("confirmation-directions-link").getAttribute("href")).toBe(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fixtures.business.address!)}`,
      );

      // Delivery shows nothing for Collect at
      rerender(
        <OrderConfirmationView
          {...props}
          order={{
            ...order,
            serviceType: "delivery",
            deliveryAddress: "10 Rue de Rivoli, Paris",
            pickupLocation: { name: "Marché de Montreuil", address: relayAddress },
          }}
          settings={fixtures.settings}
        />,
      );
      expect(screen.queryByTestId("confirmation-pickup-location")).toBeNull();
      expect(screen.queryByTestId("confirmation-directions-link")).toBeNull();
    });
  });
}
