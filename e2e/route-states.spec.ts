import { randomUUID } from "node:crypto";
import { expect, test, signIn } from "./fixtures";

const MANAGER_ROUTES = [
  "/manage",
  "/manage/orders",
  "/manage/orders/new",
  "/manage/products",
  "/manage/products/categories",
  "/manage/categories",
  "/manage/expenses",
  "/manage/expenses/new",
  "/manage/customers",
  "/manage/settings",
  "/manage/settings/about",
  "/manage/settings/account",
  "/manage/settings/business",
  "/manage/settings/inventory-finance",
  "/manage/settings/notifications",
  "/manage/settings/ordering",
  "/manage/settings/payment",
];

test("unknown locales return a real 404", async ({ request }) => {
  for (const path of ["/de", "/xx/cart"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});

test("storefront unknown product shows the localized not-found inside the shell", async ({
  page,
}) => {
  await page.goto("/fr/p/does-not-exist");
  await expect(page.getByTestId("storefront-not-found")).toContainText("Page introuvable");
  await expect(page.getByTestId("storefront-not-found-home")).toHaveAttribute("href", "/fr");
  await page.goto("/en/p/does-not-exist");
  await expect(page.getByTestId("storefront-not-found")).toContainText("Page not found");
});

// The mobile bottom nav is hidden on order sub-routes by design; the desktop sidebar stays.
test(
  "unknown manager order id renders not-found inside the shell with navigation",
  { tag: "@desktop-only" },
  async ({ page }) => {
    await signIn(page);
    await page.goto(`/manage/orders/${randomUUID()}`);
    await expect(page.getByTestId("order-not-found")).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Manager desktop sidebar" }),
    ).toBeVisible();
    await page.getByTestId("not-found-back-to-orders").click();
    await expect(page).toHaveURL("/manage/orders");
  },
);

test("every manager route renders without a server error", async ({ page }) => {
  // Walks every manager route; on a cold dev server each first visit compiles the route.
  test.setTimeout(240_000);
  await signIn(page);
  for (const path of MANAGER_ROUTES) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByTestId("manage-error")).toHaveCount(0);
    await expect(page.locator("main h1, h1").first()).toBeVisible();
  }
});
