import { expect, test, signIn, addToCartFromCatalog } from "./fixtures";
import { DEMO_PRODUCT } from "../src/lib/repositories/mock/fixtures";

// Layout that really differs between a phone and a wide screen. Each test runs in both projects
// (@desktop) and asserts the layout of the project's own viewport.

const SEED_ORDER = "/manage/orders/66666666-6666-4666-8666-666666666636";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test(
  "manager shell shows the bottom nav on a phone and the sidebar on a wide screen",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    await signIn(page);
    const bottomNav = page.getByRole("navigation", { name: "Manager mobile navigation" });
    const sidebar = page.getByRole("complementary", { name: "Manager desktop sidebar" });
    await expect(isMobile ? bottomNav : sidebar).toBeVisible();
    await expect(isMobile ? sidebar : bottomNav).toBeHidden();
    await expectNoHorizontalOverflow(page);
  },
);

test(
  "the settings action bar is fixed on a phone and in the page flow on a wide screen",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    await signIn(page);
    await page.goto("/manage/settings/ordering");
    const bar = page.getByTestId("settings-action-bar");
    await expect(bar).toBeVisible();
    await expect(bar).toHaveCSS("position", isMobile ? "fixed" : "static");
  },
);

test(
  "the dashboard and an order detail fit the viewport",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    await signIn(page);
    await expect(page.getByRole("main").getByTestId("manager-dashboard-view")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto(SEED_ORDER);
    await expect(page.getByTestId("order-detail-screen")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    // Order sub-routes hide the phone bottom nav; the wide screen keeps its sidebar.
    await expect(page.getByRole("complementary", { name: "Manager desktop sidebar" })).toBeVisible({
      visible: !isMobile,
    });
  },
);

test(
  "the storefront header and cart bar stay inside the centred content column",
  { tag: "@desktop" },
  async ({ page, isMobile }) => {
    const product = DEMO_PRODUCT.boulettes;
    await page.goto("/en");
    await expect(page.getByRole("banner")).toBeVisible();
    await addToCartFromCatalog(page, product.id);
    await page.goto("/en/cart");
    await expect(page.getByTestId("cart-items-list")).toContainText(product.name);
    await expect(page.getByTestId("cart-action-bar")).toBeVisible();
    const main = await page.getByRole("main").boundingBox();
    expect(main).toBeTruthy();
    const viewportWidth = page.viewportSize()?.width ?? 0;
    // max-w-4xl (896px) column: full width on a phone, centred with margins on a wide screen.
    if (isMobile) expect(main!.width).toBe(viewportWidth);
    else expect(main!.width).toBeLessThanOrEqual(896);
    await expectNoHorizontalOverflow(page);
  },
);
