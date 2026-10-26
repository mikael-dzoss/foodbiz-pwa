import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    })),
  ).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} WCAG AA`, () => {
    test.use({ colorScheme });

    for (const path of [
      "/en",
      "/en/cart",
      "/en/checkout",
      "/en/p/33333333-3333-4333-8333-333333333301",
      "/en/order/tk-36",
      "/fr",
      "/fr/cart",
      "/fr/checkout",
      "/fr/p/33333333-3333-4333-8333-333333333301",
      "/fr/order/tk-36",
      "/manage/login",
      "/manage",
      "/manage/products",
      "/manage/orders",
      "/manage/orders/new",
      "/manage/orders/66666666-6666-4666-8666-666666666636",
      "/manage/expenses",
    ]) {
      test(`${path} has no axe violations`, async ({ page }, testInfo) => {
        if (path.startsWith("/manage") && path !== "/manage/login") {
          await page.goto("/manage/login");
          await page.getByRole("button", { name: "Sign in as Manager (Demo Account)" }).click();
          await expect(page).toHaveURL("/manage");
        }
        if (/\/(cart|checkout)$/.test(path)) {
          const locale = path.startsWith("/fr") ? "fr" : "en";
          await page.goto(`/${locale}`);
          await page.getByRole("button", { name: /: Country Sourdough Loaf$/ }).click();
          await page.goto(`/${locale}/cart`);
          for (let i = 0; i < 3; i++) {
            await page.getByRole("button", { name: "Increase quantity", exact: true }).click();
          }
        }
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page.getByRole("main").first()).toBeVisible();
        if (path === "/manage") {
          await expect(page.getByTestId("manager-dashboard-view")).toBeVisible();
        }
        await expect(page.locator("html")).toHaveClass(
          colorScheme === "dark" ? /dark/ : /^(?!.*dark)/,
        );
        if (path.endsWith("/checkout")) {
          await expect(page.getByTestId("checkout-form")).toBeVisible();
        }
        await expectAccessible(page);
        await testInfo.attach("page", {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
        if (path === "/manage/products" || path === "/manage/expenses") {
          const isProduct = path === "/manage/products";
          await page.getByTestId(isProduct ? "add-product-button" : "add-expense-button").click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await expectAccessible(page);
          await testInfo.attach("sheet", {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
          });
        }
      });
    }
  });
}
