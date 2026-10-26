import { expect, test } from "@playwright/test";

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
  await page.getByTestId("place-order-button").click();
  await expect(page.getByTestId("checkout-success-view")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/order\/[a-f0-9]+$/);
  const trackingURL = page.url();
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
