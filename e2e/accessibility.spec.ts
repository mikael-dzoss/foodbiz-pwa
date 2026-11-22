import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";
import { expect, test, signIn } from "./fixtures";
import { DEMO_PRODUCT } from "../src/lib/repositories/mock/fixtures";

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

const DESKTOP_AXE_PATHS = new Set([
  "/en",
  "/en/cart",
  "/manage",
  "/manage/orders",
  "/manage/products",
  "/manage/settings/ordering",
]);

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} WCAG AA`, () => {
    test.use({ colorScheme });

    for (const path of [
      "/en",
      "/en/cart",
      "/en/checkout",
      "/en/p/" + DEMO_PRODUCT.chaudChaudNoyaux.id,
      "/en/order/tk-36",
      "/en/order/tk-36/confirmed",
      "/en/info",
      "/en/track",
      "/en/p/does-not-exist",
      "/fr",
      "/fr/cart",
      "/fr/checkout",
      "/fr/p/" + DEMO_PRODUCT.chaudChaudNoyaux.id,
      "/fr/order/tk-36",
      "/fr/order/tk-36/confirmed",
      "/fr/info",
      "/fr/track",
      "/manage/login",
      "/manage",
      "/manage/products",
      "/manage/products/categories",
      "/manage/categories",
      "/manage/orders",
      "/manage/orders/new",
      "/manage/orders/66666666-6666-4666-8666-666666666636",
      "/manage/expenses",
      "/manage/customers",
      "/manage/customers/44444444-4444-4444-8444-444444444401",
      "/manage/settings",
      "/manage/settings/account",
      "/manage/settings/business",
      "/manage/settings/ordering",
      "/manage/settings/payment",
      "/manage/settings/inventory-finance",
      "/manage/settings/notifications",
      "/manage/settings/about",
    ]) {
      // A few key pages also run in the desktop project (light only): the wide layouts differ.
      const wide = colorScheme === "light" && DESKTOP_AXE_PATHS.has(path);
      test(
        `${path} has no axe violations`,
        { tag: wide ? "@desktop" : [] },
        async ({ page }, testInfo) => {
          if (path.startsWith("/manage") && path !== "/manage/login") {
            await signIn(page);
          }
          if (/\/(cart|checkout)$/.test(path)) {
            const locale = path.startsWith("/fr") ? "fr" : "en";
            await page.goto(`/${locale}`);
            await page
              .getByTestId(`product-row-${DEMO_PRODUCT.boulettes.id}`)
              .getByRole("button", { name: new RegExp(`: ${DEMO_PRODUCT.boulettes.name}$`) })
              .click();
            await page.goto(`/${locale}/cart`);
            for (let i = 0; i < 3; i++) {
              await page
                .getByRole("button", {
                  name: locale === "fr" ? "Augmenter la quantité" : "Increase quantity",
                  exact: true,
                })
                .click();
            }
          }
          const response = await page.goto(path);
          expect(response?.status()).toBe(path.endsWith("/does-not-exist") ? 404 : 200);
          await expect(page.getByRole("main").first()).toBeVisible();
          if (path === "/manage") {
            // Scoped to main: a streamed boundary that React client-rendered can leave its hidden server
            // HTML at the end of body (see #296).
            await expect(
              page.getByRole("main").getByTestId("manager-dashboard-view"),
            ).toBeVisible();
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
        },
      );
    }
  });
}

test.describe("skip link and heading structure", () => {
  for (const path of ["/en", "/fr", "/en/info", "/manage/login", "/manage", "/manage/orders"]) {
    test(`${path}: Tab reaches the skip link first and Enter moves focus to main`, async ({
      page,
    }) => {
      if (path.startsWith("/manage") && path !== "/manage/login") {
        await signIn(page);
      }
      await page.goto(path);
      await expect(page.locator("#main-content")).toBeAttached();
      await page.keyboard.press("Tab");
      const skip = page.getByTestId("skip-link");
      await expect(skip).toBeFocused();
      await expect(skip).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(page.locator("main#main-content")).toBeFocused();
    });
  }

  for (const path of [
    "/en",
    "/en/info",
    "/en/track",
    "/manage/login",
    "/manage",
    "/manage/orders",
  ]) {
    test(`${path} has one h1 and no skipped heading levels`, async ({ page }) => {
      if (path.startsWith("/manage") && path !== "/manage/login") {
        await signIn(page);
      }
      await page.goto(path);
      await expect(page.getByRole("main").first()).toBeVisible();
      const levels = await page.evaluate(() =>
        [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => Number(h.tagName.slice(1))),
      );
      expect(levels.filter((level) => level === 1)).toHaveLength(1);
      expect(levels[0]).toBe(1);
      levels.forEach((level, i) => {
        if (i > 0) expect(level).toBeLessThanOrEqual(levels[i - 1] + 1);
      });
    });
  }

  test("storefront server HTML carries the requested language", async ({ request }) => {
    for (const locale of ["en", "fr"]) {
      const html = await (await request.get(`/${locale}`)).text();
      expect(html).toMatch(new RegExp(`<html[^>]*lang="${locale}"`));
    }
  });
});
