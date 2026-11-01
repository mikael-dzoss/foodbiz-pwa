import { expect, test } from "@playwright/test";
import { getDictionary } from "../src/domain/i18n";
import { formatMoney } from "../src/domain/formatting";

for (const [locale, method, recipient, phone] of [
  ["en", "revolut", "@boulangerie", "+33600000106"],
  ["fr", "wero", "+33612345678", "+33600000107"],
] as const) {
  test(`${locale} ${method} confirmation shows payment values and preserves the token`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    await page.getByTestId("service-mode-pickup").click();
    await page.getByRole("button", { name: /: Country Sourdough Loaf$/ }).click();
    await page.goto(`/${locale}/cart`);
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Increase quantity", exact: true }).click();
    }
    await page.getByTestId("proceed-checkout-button").click();
    await page.getByTestId("checkout-name-input").fill(`E2E ${method} Guest`);
    await page.getByTestId("checkout-phone-input").fill(phone);
    await page.getByTestId(`payment-${method}`).click();
    await page.getByTestId("place-order-button").click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/order/[a-f0-9]{32}/confirmed$`));
    const token = page.url().split("/").at(-2);
    const payment = page.getByTestId("confirmation-payment");
    await expect(payment).toContainText(recipient);
    await expect(payment).toContainText(formatMoney(1800, locale));
    await expect(payment).toContainText(getDictionary(locale).orderTracking.unpaidBadge);
    await page.getByTestId("confirmation-track-link").click();
    await expect(page).toHaveURL(`/${locale}/order/${token}`);
    await expect(page.getByTestId("tracking-status-badge")).toContainText(
      getDictionary(locale).orderTracking.statuses.NEW,
    );
    await expect(page.getByTestId("tracking-summary-card")).toContainText(
      formatMoney(1800, locale),
    );
  });
}

test("customer checkout reaches confirmation and tracking reflects manager acceptance", async ({
  page,
  browser,
}) => {
  await page.goto("/en");
  await page
    .getByRole("button", { name: "Add to cart: Country Sourdough Loaf", exact: true })
    .click();
  await page.goto("/en/cart");
  await expect(page.getByTestId("cart-items-list")).toContainText("Country Sourdough Loaf");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Increase quantity", exact: true }).click();
  }
  await page.getByTestId("proceed-checkout-button").click();
  await page.getByTestId("checkout-name-input").fill("E2E Checkout Guest");
  await page.getByTestId("checkout-phone-input").fill("+33600000105");
  await page.getByTestId("service-delivery-button").click();
  await page.getByTestId("checkout-address-input").fill("Private delivery 105 Test Street");
  await page.getByTestId("checkout-notes-input").fill("Private entry code 10599");
  await page.getByTestId("place-order-button").click();
  await expect(page.getByTestId("checkout-success-view")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/order\/[a-f0-9]{32}\/confirmed$/);
  const confirmationURL = page.url();
  const confirmationResponse = await page.reload();
  const privateValues = [
    "E2E Checkout Guest",
    "+33600000105",
    "Private delivery 105 Test Street",
    "Private entry code 10599",
  ];
  const confirmationHTML = await confirmationResponse!.text();
  for (const value of privateValues) expect(confirmationHTML).not.toContain(value);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.getByTestId("confirmation-payment")).toContainText("cash, Revolut or Wero");
  await expect(page.getByTestId("confirmation-payment")).toContainText("Unpaid");
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(confirmationURL);
  await page.getByTestId("confirmation-track-link").click();
  await expect(page).toHaveURL(/\/en\/order\/[a-f0-9]{32}$/);
  const trackingURL = page.url();
  const trackingResponse = await page.reload();
  const trackingHTML = await trackingResponse!.text();
  for (const value of privateValues) expect(trackingHTML).not.toContain(value);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.getByTestId("tracking-status-badge")).toContainText("Order Placed");
  const ticket = await page.getByTestId("tracking-order-title").innerText();

  const managerContext = await browser.newContext();
  try {
    const manager = await managerContext.newPage();
    await manager.goto("/manage/login");
    await manager.getByRole("button", { name: "Sign in as Manager (Demo Account)" }).click();
    await expect(manager).toHaveURL("/manage");
    await manager.goto("/manage/orders");
    await manager
      .getByRole("link", {
        name: `View order details for ${ticket.replace("Order ", "")}`,
        exact: true,
      })
      .click();
    await manager.getByTestId("accept-order-button").click();
    await expect(manager.getByTestId("order-detail-screen")).toContainText("CONFIRMED");
    await page.goto(trackingURL);
    await expect(page.getByTestId("tracking-status-badge")).toContainText("Confirmed");
    await expect(page.getByTestId("tracking-order-title")).toHaveText(ticket);
  } finally {
    await managerContext.close();
  }
});
