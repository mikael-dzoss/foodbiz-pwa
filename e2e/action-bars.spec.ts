import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function expectBarAboveFooter(page: Page, barTestId: string) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const footer = page.getByRole("contentinfo");
  await expect(footer).toBeInViewport();
  const bar = await page.getByTestId(barTestId).boundingBox();
  const foot = await footer.boundingBox();
  expect(bar && foot).toBeTruthy();
  // Bar bottom edge sits at or above the footer's top edge: no overlap.
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(foot!.y + 1);
}

test(
  "storefront action bars never cover the footer (#237, #249)",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto("/en");
    await page
      .getByRole("button", { name: "Add to cart: Country Sourdough Loaf", exact: true })
      .click();

    await page.goto("/en/cart");
    await expect(page.getByTestId("cart-items-list")).toContainText("Country Sourdough Loaf");
    await expectBarAboveFooter(page, "cart-action-bar");

    await page.goto("/en/checkout");
    await expect(page.getByTestId("checkout-form")).toBeVisible();
    await expectBarAboveFooter(page, "checkout-action-bar");

    await page.goto("/en/info");
    const infoBar = page.getByRole("main").getByTestId("shop-info-action-bar");
    await expect(infoBar).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const policyCard = await page.getByRole("main").locator("#ordering-policy").boundingBox();
    const bar = await infoBar.boundingBox();
    expect(policyCard && bar).toBeTruthy();
    // Bar sits below the policy card when scrolled to the end of the page: no overlap (#249).
    expect(bar!.y).toBeGreaterThanOrEqual(policyCard!.y + policyCard!.height - 1);
  },
);
