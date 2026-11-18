import { expect, test } from "@playwright/test";
import { getDictionary } from "../src/domain/i18n";
import { formatMoney } from "../src/domain/formatting";

test("storefront sticky category bar appears after scrolling past first category and Menu sheet navigates", async ({
  page,
}) => {
  await page.goto("/en");
  const featured = page.getByTestId("featured-section");
  await expect(featured).toBeVisible();
  await expect(featured.getByRole("article").first()).toBeVisible();
  await expect(featured.getByRole("article")).not.toHaveCount(0);
  await expect(page.getByTestId("category-nav-sentinel")).toBeVisible();
  await expect(page.getByTestId("sticky-category-nav")).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(page.getByTestId("sticky-category-nav")).toBeVisible();

  await page.getByTestId("category-nav-menu-button").click();
  const sheet = page.getByTestId("category-nav-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Menu" })).toBeVisible();
  await expect(sheet.getByRole("navigation").getByRole("button").first()).toHaveText(
    "Featured items",
  );
  await page.getByTestId("category-nav-sheet-item-featured").click();
  await expect(page.locator("#category-heading-featured")).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(page.getByTestId("sticky-category-nav")).toBeVisible();
  await page.getByTestId("category-nav-menu-button").click();

  await page.getByTestId("category-nav-sheet-item-22222222-2222-4222-8222-222222222202").click();
  await expect(sheet).toBeHidden();
  await expect(
    page.locator("#category-heading-22222222-2222-4222-8222-222222222202"),
  ).toBeFocused();

  const searchLauncher = page.getByTestId("catalog-search-launcher");
  await expect(searchLauncher).toBeVisible();
  await searchLauncher.click();

  const searchDialog = page.getByRole("dialog", { name: "Search the menu" });
  await expect(searchDialog).toBeVisible();
  const searchInput = page.getByTestId("menu-search-input");
  await expect(searchInput).toBeFocused();

  await searchInput.fill("crois");
  await expect(page.getByTestId("menu-search-results-count")).toContainText(/result/i);
  await expect(page.getByTestId("menu-search-results")).toContainText("Croissant");

  await page.getByTestId("menu-search-back-button").click();
  await expect(searchDialog).toBeHidden();
  await expect(searchLauncher).toBeFocused();
});

test("storefront dish detail adds selected drink as a separate cart line", async ({
  page,
  browser,
}) => {
  await page.goto("/en/p/33333333-3333-4333-8333-333333333301");
  const addButton = page.getByTestId("product-add-button");
  if (await addButton.isDisabled()) {
    const managerContext = await browser.newContext();
    try {
      const manager = await managerContext.newPage();
      await manager.goto("/manage/login");
      await manager.getByTestId("btn-demo-sign-in").click();
      await expect(manager).toHaveURL("/manage");
      await manager.goto("/manage/settings/ordering");
      await manager.getByTestId("input-opening-hours").fill("00:00 - 23:59");
      await manager
        .getByTestId("ordering-settings-form")
        .evaluate((form: HTMLFormElement) => form.requestSubmit());
      await expect(manager.getByText(/Ordering settings updated successfully/i)).toBeVisible();
    } finally {
      await managerContext.close();
    }
    await page.reload();
  }

  const addOnsGroup = page.getByTestId("product-addons-group");
  await expect(addOnsGroup).toBeVisible();
  await expect(addOnsGroup).toContainText("Drinks");

  const espressoCheckbox = addOnsGroup.getByRole("checkbox", { name: /Double Espresso/i });
  await espressoCheckbox.click();
  await expect(espressoCheckbox).toBeChecked();

  await expect(addButton).toContainText(`Add 1 to cart • ${formatMoney(350, "en")}`);
  await addButton.click();
  await expect(espressoCheckbox).not.toBeChecked();

  await page.goto("/en/cart");
  const cartList = page.getByTestId("cart-items-list");
  await expect(cartList).toContainText("Traditional Baguette");
  await expect(cartList).toContainText("Double Espresso");
});

for (const [locale, method, recipient, phone] of [
  ["en", "revolut", "@boulangerie", "+33600000106"],
  ["fr", "wero", "+33612345678", "+33600000107"],
] as const) {
  test(`${locale} ${method} confirmation shows payment values and preserves the token`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    await page.getByTestId("service-mode-pickup").click();
    await page
      .getByTestId("product-row-33333333-3333-4333-8333-333333333302")
      .getByRole("button", { name: /: Country Sourdough Loaf$/ })
      .click();
    await page.goto(`/${locale}/cart`);
    for (let i = 0; i < 3; i++) {
      await page
        .getByRole("button", { name: getDictionary(locale).common.increaseQuantity, exact: true })
        .click();
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
    .getByTestId("product-row-33333333-3333-4333-8333-333333333302")
    .getByRole("button", { name: "Add to cart: Country Sourdough Loaf", exact: true })
    .click();
  await page.goto("/en/cart");
  await expect(page.getByTestId("cart-items-list")).toContainText("Country Sourdough Loaf");
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: getDictionary(locale).common.increaseQuantity, exact: true })
      .click();
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
    await manager.getByTestId("btn-demo-sign-in").click();
    await expect(manager).toHaveURL("/manage");
    await manager.goto("/manage/orders");
    await manager
      .getByRole("link", {
        name: `View order details for ${ticket.replace("Order ", "")}`,
        exact: true,
      })
      .click();
    await manager.getByTestId("accept-order-button").click();
    await expect(manager.getByTestId("order-detail-screen")).toContainText("Confirmed");
    await page.goto(trackingURL);
    await expect(page.getByTestId("tracking-status-badge")).toContainText("Confirmed");
    await expect(page.getByTestId("tracking-order-title")).toHaveText(ticket);
  } finally {
    await managerContext.close();
  }
});
