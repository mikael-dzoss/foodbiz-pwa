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
 * Signs in as the demo manager and waits for the dashboard. Waits for the sign-in button to be
 * ready, confirms the click triggered the login POST (retrying if hydration dropped it), gives a
 * cold `/manage` compile enough time to redirect without aborting in-flight requests, and waits
 * for the dashboard landmark before returning.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/manage/login");
  const signInButton = page.getByTestId("btn-demo-sign-in");
  await expect(signInButton).toBeVisible();
  await expect(signInButton).toBeEnabled();

  await expect(async () => {
    if (new URL(page.url()).pathname.startsWith("/manage/login")) {
      const postPromise = page
        .waitForRequest(
          (req) => req.method() === "POST" && new URL(req.url()).pathname === "/manage/login",
          { timeout: 3_000 },
        )
        .catch(() => null);
      await signInButton.click();
      const post = await postPromise;
      if (!post && new URL(page.url()).pathname.startsWith("/manage/login")) {
        throw new Error("Sign-in click did not trigger POST");
      }
    }
    await expect(page).toHaveURL("/manage", { timeout: 30_000 });
  }).toPass({ timeout: 45_000 });

  await expect(page.getByRole("main").getByTestId("manager-dashboard-view")).toBeVisible({
    timeout: 30_000,
  });
}
