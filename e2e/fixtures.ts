import { expect, test as base, type Page } from "@playwright/test";

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
 * Signs in as the demo manager and waits for the dashboard. The first click can land before the
 * page has hydrated on a cold dev server, so the click is retried until the redirect happens.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/manage/login");
  await expect(async () => {
    await page.getByTestId("btn-demo-sign-in").click();
    await expect(page).toHaveURL("/manage", { timeout: 5_000 });
  }).toPass({ timeout: 40_000 });
}
