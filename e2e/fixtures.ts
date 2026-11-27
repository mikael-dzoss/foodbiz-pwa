import { expect, test as base, type Page } from "@playwright/test";
import { MOCK_AUTH_COOKIE_NAME } from "../src/domain/auth";

/**
 * Every spec imports `test` and `expect` from here, not from `@playwright/test`.
 *
 * The mock repositories live in the memory of the one dev server, so a test's orders, products,
 * customers and settings would leak into the next one. The auto fixture resets them to the seed
 * data before each test (POST /api/test/reset, answered only under E2E_TEST_HOOKS=1 with the mock
 * data source). That is a global reset, so the suite must keep running one test at a time.
 */
export const test = base.extend<{ resetMockData: void }>({
  resetMockData: [
    async ({ request }, use) => {
      const response = await request.post("/api/test/reset");
      expect(response.status(), "mock reset hook (is E2E_TEST_HOOKS=1 set?)").toBe(204);
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Signs in as the demo manager for tests whose subject is not the sign-in flow. It sets the mock
 * session cookie that `signInMockAction` sets and opens the dashboard, so setup does not depend on a
 * server action round trip: clicking the demo button for every test timed out under machine load
 * (#325). The button flow itself is covered by `signInWithDemoButton` in manager.spec.ts.
 */
export async function signIn(page: Page): Promise<void> {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("signIn needs a Playwright baseURL");
  await page.context().addCookies([
    {
      name: MOCK_AUTH_COOKIE_NAME,
      value: "active",
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/manage");
  await expect(page).toHaveURL("/manage");
  await expect(page.getByRole("main").getByTestId("manager-dashboard-view")).toBeVisible();
}

/**
 * Signs in through the demo button, as a manager would: one click once the button is hydrated, then
 * the dashboard within 10 s. No retry loop: a sign-in slower than that is a bug to investigate, not
 * something the test should wait out.
 */
export async function signInWithDemoButton(page: Page): Promise<void> {
  await page.goto("/manage/login", { waitUntil: "load" });
  const signInButton = page.getByTestId("btn-demo-sign-in");
  await expect(signInButton).toBeEnabled();
  await signInButton.click();
  await expect(page).toHaveURL("/manage", { timeout: 10_000 });
  await expect(page.getByRole("main").getByTestId("manager-dashboard-view")).toBeVisible();
}

/**
 * Adds one unit of a product from the storefront catalog and waits until the cart bar counts it.
 * A click that lands before the catalog has hydrated is dropped, and a test that then opens the cart
 * waits 60 s for controls of an empty cart (#325). The click is repeated only when the count did not
 * move, so a late but registered click is never doubled.
 */
export async function addToCartFromCatalog(page: Page, productId: string): Promise<void> {
  const cartBar = page.getByTestId("storefront-cart-bar");
  const readCount = async (): Promise<number> =>
    (await cartBar.count()) > 0 ? Number((await cartBar.getAttribute("data-count")) ?? 0) : 0;
  const before = await readCount();
  const button = page
    .getByTestId(`product-row-${productId}`)
    .getByTestId(`add-to-cart-${productId}`);
  for (let attempt = 0; attempt < 3; attempt++) {
    await button.click();
    try {
      await expect(cartBar).toHaveAttribute("data-count", String(before + 1), { timeout: 3_000 });
      return;
    } catch {
      if ((await readCount()) > before) return;
    }
  }
  throw new Error(`Adding ${productId} to the cart did not update the cart bar`);
}
