import type { Page } from "@playwright/test";
import { expect, test, signIn } from "./fixtures";
import { getDictionary } from "../src/domain/i18n";
import { formatMoney } from "../src/domain/formatting";
import {
  DEMO_CATEGORY_IDS,
  DEMO_PRODUCT,
  demoSettings,
} from "../src/lib/repositories/mock/fixtures";

/**
 * Outside the mock shop's opening hours the checkout forces "Schedule for later" (#350), so pick a
 * date two days out; inside hours the date input is hidden and ASAP stays the default.
 */
async function scheduleIfClosed(page: Page) {
  const dateInput = page.getByTestId("checkout-date-input");
  if (!(await dateInput.isVisible())) return;
  const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await dateInput.fill(date);
}

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

  await page.getByTestId(`category-nav-sheet-item-${DEMO_CATEGORY_IDS.traditional}`).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator(`#category-heading-${DEMO_CATEGORY_IDS.traditional}`)).toBeFocused();

  const searchLauncher = page.getByTestId("catalog-search-launcher");
  await expect(searchLauncher).toBeVisible();
  await searchLauncher.click();

  const searchDialog = page.getByRole("dialog", { name: "Search the menu" });
  await expect(searchDialog).toBeVisible();
  const searchInput = page.getByTestId("menu-search-input");
  await expect(searchInput).toBeFocused();

  await searchInput.fill("beign");
  await expect(page.getByTestId("menu-search-results-count")).toContainText(/result/i);
  await expect(page.getByTestId("menu-search-results")).toContainText(
    DEMO_PRODUCT.beignetsSouffles.name,
  );

  await page.getByTestId("menu-search-back-button").click();
  await expect(searchDialog).toBeHidden();
  await expect(searchLauncher).toBeFocused();
});

test("storefront dish detail adds selected drink as a separate cart line", async ({
  page,
  browser,
}) => {
  const dish = DEMO_PRODUCT.chaudChaudNoyaux;
  const drink = DEMO_PRODUCT.folere;
  await page.goto(`/en/p/${dish.id}`);
  const addButton = page.getByTestId("product-add-button");
  if (await addButton.isDisabled()) {
    const managerContext = await browser.newContext();
    try {
      const manager = await managerContext.newPage();
      await signIn(manager);
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

  const drinkCheckbox = addOnsGroup.getByRole("checkbox", { name: new RegExp(drink.name, "i") });
  await drinkCheckbox.click();
  await expect(drinkCheckbox).toBeChecked();

  await expect(addButton).toContainText(
    `Add 1 to cart • ${formatMoney(dish.price + drink.price, "en")}`,
  );
  await addButton.click();
  await expect(drinkCheckbox).not.toBeChecked();

  await page.goto("/en/cart");
  const cartList = page.getByTestId("cart-items-list");
  await expect(cartList).toContainText(dish.name);
  await expect(cartList).toContainText(drink.name);
});

for (const [locale, method, recipient, phone] of [
  ["en", "revolut", demoSettings.revolutRevtag!, "+33600000106"],
  ["fr", "wero", demoSettings.weroIdentifier!, "+33600000107"],
] as const) {
  test(`${locale} ${method} confirmation shows payment values and preserves the token`, async ({
    page,
  }) => {
    const product = DEMO_PRODUCT.boulettes;
    const expectedTotal = product.price * 4;
    await page.goto(`/${locale}`);
    await page.getByTestId("service-mode-pickup").click();
    await page
      .getByTestId(`product-row-${product.id}`)
      .getByRole("button", { name: new RegExp(`: ${product.name}$`) })
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
    await scheduleIfClosed(page);
    await page.getByTestId("place-order-button").click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/order/[a-f0-9]{32}/confirmed$`));
    const token = page.url().split("/").at(-2);
    const payment = page.getByTestId("confirmation-payment");
    await expect(payment).toContainText(recipient);
    await expect(payment).toContainText(formatMoney(expectedTotal, locale));
    await expect(payment).toContainText(getDictionary(locale).orderTracking.unpaidBadge);
    await page.getByTestId("confirmation-track-link").click();
    await expect(page).toHaveURL(`/${locale}/order/${token}`);
    await expect(page.getByTestId("tracking-status-badge")).toContainText(
      getDictionary(locale).orderTracking.statuses.NEW,
    );
    await expect(page.getByTestId("tracking-summary-card")).toContainText(
      formatMoney(expectedTotal, locale),
    );
  });
}

test("customer checkout reaches confirmation and tracking reflects manager acceptance", async ({
  page,
  browser,
}) => {
  const product = DEMO_PRODUCT.boulettes;
  await page.goto("/en");
  await page
    .getByTestId(`product-row-${product.id}`)
    .getByRole("button", { name: `Add to cart: ${product.name}`, exact: true })
    .click();
  await page.goto("/en/cart");
  await expect(page.getByTestId("cart-items-list")).toContainText(product.name);
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: getDictionary("en").common.increaseQuantity, exact: true })
      .click();
  }
  await page.getByTestId("proceed-checkout-button").click();
  await page.getByTestId("checkout-name-input").fill("E2E Checkout Guest");
  await page.getByTestId("checkout-phone-input").fill("+33600000105");
  await page.getByTestId("service-delivery-button").click();
  await page.getByTestId("checkout-address-input").fill("Private delivery 105 Test Street");
  await page.getByTestId("checkout-notes-input").fill("Private entry code 10599");
  await scheduleIfClosed(page);
  await page.getByTestId("place-order-button").click();
  await expect(page.getByTestId("checkout-success-view")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/order\/[a-f0-9]{32}\/confirmed$/);
  const confirmationURL = page.url();
  const confirmationResponse = await page.reload();
  // The delivery address is shown to the tracking-token holder (#352); the guest's name, phone
  // and notes never reach these pages.
  const deliveryAddress = "Private delivery 105 Test Street";
  const privateValues = ["E2E Checkout Guest", "+33600000105", "Private entry code 10599"];
  const confirmationHTML = await confirmationResponse!.text();
  for (const value of privateValues) expect(confirmationHTML).not.toContain(value);
  await expect(page.getByTestId("confirmation-delivery-address")).toContainText(deliveryAddress);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.getByTestId("confirmation-payment")).toContainText(
    "Pay in cash at pickup or delivery",
  );
  await expect(page.getByTestId("confirmation-payment")).toContainText("Unpaid");
  // Once hydrated and idle the confirmation must have stayed put (no redirect away).
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(confirmationURL);
  await page.getByTestId("confirmation-track-link").click();
  await expect(page).toHaveURL(/\/en\/order\/[a-f0-9]{32}$/);
  const trackingURL = page.url();
  const trackingResponse = await page.reload();
  const trackingHTML = await trackingResponse!.text();
  for (const value of privateValues) expect(trackingHTML).not.toContain(value);
  await expect(page.getByTestId("tracking-delivery-address")).toContainText(deliveryAddress);
  await expect(page.getByTestId("tracking-directions-link")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.getByTestId("tracking-status-badge")).toContainText("Order Placed");
  const ticket = await page.getByTestId("tracking-order-title").innerText();

  const managerContext = await browser.newContext();
  try {
    const manager = await managerContext.newPage();
    await signIn(manager);
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
