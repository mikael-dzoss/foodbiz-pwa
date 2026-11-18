import { expect, test, type Page } from "@playwright/test";

// The manager language is a cookie set from Account settings; French is the longer language, so
// the pages are also checked for horizontal overflow at 360 px.
test.use({ viewport: { width: 360, height: 780 } });

async function signInInFrench(page: Page) {
  await page
    .context()
    .addCookies([{ name: "foodbiz_locale", value: "fr", url: "http://127.0.0.1:3100" }]);
  await page.goto("/manage/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  // The first click can land before hydration on a cold dev server: retry until signed in.
  await expect(async () => {
    await page.getByTestId("btn-demo-sign-in").click();
    await expect(page).toHaveURL("/manage", { timeout: 5_000 });
  }).toPass({ timeout: 40_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("the manager dashboard, orders and settings render in French", async ({ page }) => {
  await signInInFrench(page);

  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
  await expect(page.getByTestId("kpi-revenue")).toContainText("Chiffre d'affaires");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expectNoHorizontalOverflow(page);

  await page.goto("/manage/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Commandes" })).toBeVisible();
  await expect(page.getByTestId("tab-active")).toContainText("En cours");
  await expect(page.getByTestId("create-order-button")).toContainText("Nouvelle commande");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expectNoHorizontalOverflow(page);

  await page.goto("/manage/settings");
  await expect(page.getByTestId("settings-hub")).toContainText("Paramètres");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expectNoHorizontalOverflow(page);

  await page.goto("/manage/settings/payment");
  await expect(page.getByTestId("save-payment-button")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("switching the language in Account settings updates the manager and <html lang>", async ({
  page,
}) => {
  await page.goto("/manage/login");
  await page.getByTestId("btn-demo-sign-in").click();
  await expect(page).toHaveURL("/manage");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

  await page.goto("/manage/settings/account");
  await page.getByTestId("lang-fr").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");

  await page.goto("/manage");
  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
});
