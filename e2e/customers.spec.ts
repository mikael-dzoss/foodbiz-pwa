import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("customer edits persist and canonical names propagate to linked orders", async ({ page }) => {
  const suffix = randomUUID().replace(/\D/g, "").padEnd(8, "0").slice(0, 8);
  const phone = `+336${suffix}`;
  const name = `Guest ${randomUUID().slice(0, 8)}`;
  const updated = `${name} updated`;
  await page.goto("/manage/login");
  await page.getByRole("button", { name: "Sign in as Manager (Demo Account)" }).click();
  await expect(page).toHaveURL("/manage");
  await page.goto("/manage/orders/new");
  await page.getByTestId("guest-phone-input").fill(phone);
  await page.getByTestId("guest-name-input").fill(name);
  await page
    .getByTestId("product-row-33333333-3333-4333-8333-333333333301")
    .getByRole("button", { name: "Increase quantity" })
    .click();
  await page.getByTestId("create-order-submit-button").click();
  await page.getByTestId("confirm-create-order-button").click();
  await expect(page).toHaveURL(/\/manage\/orders\/[a-f0-9-]+$/);
  const orderUrl = page.url();
  await page.goto("/manage/customers");
  await page.getByRole("searchbox").fill(phone);
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByRole("link", { name: "Call", exact: true })).toHaveAttribute(
    "href",
    `tel:${phone}`,
  );
  await expect(page.getByRole("link", { name: "WhatsApp", exact: true })).toHaveAttribute(
    "href",
    `https://wa.me/${phone.slice(1)}`,
  );
  await page.getByLabel("Name", { exact: true }).fill(updated);
  await page.getByLabel("Private notes").fill("Call before delivery.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Customer details saved.");
  await page.reload();
  await expect(page.getByRole("heading", { name: updated, exact: true })).toBeVisible();
  await expect(page.getByLabel("Private notes")).toHaveValue("Call before delivery.");
  await expect(page.getByRole("main").getByTestId("customer-order-history")).toContainText(updated);
  await page.goto(orderUrl);
  await expect(page.getByTestId("order-detail-screen")).toContainText(updated);
  await page.goto("/manage/orders");
  await expect(page.getByRole("main")).toContainText(updated);
});

for (const locale of ["en", "fr"] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    test.describe(`${locale} ${colorScheme} customers`, () => {
      test.use({ colorScheme });
      test("list and detail preserve the mobile visual contract and WCAG AA", async ({
        page,
        context,
      }, testInfo) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await context.addCookies([
          { name: "foodbiz_locale", value: locale, url: "http://127.0.0.1:3100" },
        ]);
        await page.goto("/manage/login");
        await page.getByRole("button", { name: "Sign in as Manager (Demo Account)" }).click();
        await expect(page).toHaveURL("/manage");
        const main = page.getByRole("main");
        for (const width of [360, 390]) {
          await page.setViewportSize({ width, height: 844 });
          for (const path of [
            "/manage/customers",
            "/manage/customers/44444444-4444-4444-8444-444444444401",
          ]) {
            expect((await page.goto(path))?.status()).toBe(200);
            await expect(
              main.getByTestId(
                path.endsWith("customers") ? "customer-list-screen" : "customer-detail-screen",
              ),
            ).toBeVisible();
            if (path.endsWith("customers")) {
              const firstRow = main.getByTestId("customer-list").getByRole("link").first();
              await expect(firstRow).toHaveCSS("padding-top", "14px");
              await expect(firstRow).toHaveCSS("padding-bottom", "14px");
              const row = await firstRow.boundingBox();
              expect(row?.height).toBe(90);
              await expect(main.getByTestId("customer-results-count")).toBeVisible();
              await expect(main.getByTestId("customer-list")).toHaveCSS("row-gap", "normal");
              await expect(main.locator("header")).toHaveCSS("height", "56px");
              await expect(main.getByRole("searchbox")).toHaveCSS("height", "44px");
            } else {
              await expect(
                page.getByRole("navigation", { name: "Manager mobile navigation" }),
              ).toHaveCount(0);
              await expect(
                page.getByRole("link", {
                  name: locale === "fr" ? "Retour aux clients" : "Back to customers",
                }),
              ).toBeVisible();
              const metrics = main.getByTestId("customer-metrics");
              await expect(metrics).toHaveCSS("column-gap", "8px");
              const tileBounds = await metrics.locator(":scope > div").evaluateAll((tiles) =>
                tiles.map((tile) => {
                  const rect = tile.getBoundingClientRect();
                  return { top: rect.top, width: rect.width };
                }),
              );
              expect(tileBounds).toHaveLength(3);
              expect(new Set(tileBounds.map((tile) => tile.top)).size).toBe(1);
              const formWidth = (await main.getByTestId("customer-edit-form").boundingBox())?.width;
              const saveWidth = (await main.getByTestId("customer-save-button").boundingBox())
                ?.width;
              expect(saveWidth).toBe((formWidth ?? 0) - 34);
            }
            await expect(page.locator("html")).toHaveClass(
              colorScheme === "dark" ? /dark/ : /^(?!.*dark)/,
            );
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
            ).toBe(true);
            const results = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
              .analyze();
            expect(results.violations).toEqual([]);
            await testInfo.attach(`${path.endsWith("customers") ? "list" : "detail"}-${width}`, {
              body: await page.screenshot({ fullPage: true }),
              contentType: "image/png",
            });
          }
        }
      });
    });
  }
}
