import { expect, test } from "./fixtures";
import { formatPhoneNumber } from "../src/domain/formatting";
import { demoGuests } from "../src/lib/repositories/mock/fixtures";

const LOOKUP_PHONE = formatPhoneNumber(demoGuests[0].phone!, "national");

test("customer finds an order by phone and order number (#230)", async ({ page }) => {
  await page.goto("/en/track");
  await expect(page.getByRole("heading", { level: 1, name: "Track your order" })).toBeVisible();

  await page.getByLabel("Phone number").fill(LOOKUP_PHONE);
  await page.getByLabel("Order number").fill("35");
  await page.getByTestId("order-lookup-submit").click();
  await expect(page.getByTestId("order-lookup-error")).toContainText("We couldn't find an order");
  await expect(page.getByLabel("Phone number")).toHaveValue(LOOKUP_PHONE);

  await page.getByLabel("Order number").fill("36");
  await page.getByTestId("order-lookup-submit").click();
  await expect(page).toHaveURL(/\/en\/order\/tk-36$/);
});
