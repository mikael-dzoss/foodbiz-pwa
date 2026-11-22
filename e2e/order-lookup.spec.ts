import { expect, test } from "./fixtures";

test("customer finds an order by phone and order number (#230)", async ({ page }) => {
  await page.goto("/en/track");
  await expect(page.getByRole("heading", { level: 1, name: "Track your order" })).toBeVisible();

  await page.getByLabel("Phone number").fill("06 12 34 56 71");
  await page.getByLabel("Order number").fill("35");
  await page.getByTestId("order-lookup-submit").click();
  await expect(page.getByTestId("order-lookup-error")).toContainText("We couldn't find an order");
  await expect(page.getByLabel("Phone number")).toHaveValue("06 12 34 56 71");

  await page.getByLabel("Order number").fill("36");
  await page.getByTestId("order-lookup-submit").click();
  await expect(page).toHaveURL(/\/en\/order\/tk-36$/);
});
