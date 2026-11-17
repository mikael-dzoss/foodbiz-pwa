import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/manage/login");
  await page.getByTestId("btn-demo-sign-in").click();
  await expect(page).toHaveURL("/manage");
});

test("product CRUD persists edits and soft deletion", async ({ page }) => {
  const name = `E2E bread ${randomUUID()}`;
  await page.goto("/manage/products");
  await expect(page.getByTestId("manager-category-nav")).toBeVisible();
  await page.getByTestId("category-nav-tab-22222222-2222-4222-8222-222222222202").click();
  await expect(
    page.locator("#category-heading-22222222-2222-4222-8222-222222222202"),
  ).toBeFocused();
  await page.getByRole("button", { name: /add product/i }).click();
  await page.getByTestId("product-name-input").fill(name);
  await page.getByTestId("product-price-input").fill("8.50");
  await page.getByTestId("product-unit-cost-input").fill("2.00");
  await page.getByTestId("product-stock-input").fill("10");
  await page.getByTestId("save-product-button").click();
  await expect(page.getByTestId("product-form-sheet")).not.toBeVisible();
  await page.reload();
  await page.getByTestId("product-search-input").fill(name);
  const row = page.getByTestId("product-list");
  await expect(row).toContainText(name);
  await row.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  await page.getByTestId("product-name-input").fill(`${name} updated`);
  await page.getByTestId("product-price-input").fill("9.50");
  await page.getByTestId("save-product-button").click();
  await expect(page.getByTestId("product-form-sheet")).not.toBeVisible();
  await page.reload();
  await page.getByTestId("product-search-input").fill(name);
  await expect(row).toContainText(`${name} updated`);
  await expect(row).toContainText("9.50");
  await row.getByRole("button", { name: `Hide ${name} updated`, exact: true }).click();
  await expect(row).toContainText("Hidden");
  await page.reload();
  await page.getByTestId("product-search-input").fill(name);
  await expect(row).toContainText("Hidden");
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: `${name} updated`, exact: true })).toHaveCount(0);
});

test("manual order requires payment before completion", async ({ page }) => {
  await page.goto("/manage/orders/new");
  await page.getByTestId("guest-phone-input").fill("+33600000104");
  await page.getByTestId("guest-name-input").fill("E2E Manual Guest");
  await page
    .getByTestId("product-row-33333333-3333-4333-8333-333333333301")
    .getByRole("button", { name: "Increase quantity" })
    .click();
  await page.getByTestId("create-order-submit-button").click();
  await page.getByTestId("confirm-create-order-button").click();
  await expect(page).toHaveURL(/\/manage\/orders\/[a-f0-9-]+$/);
  await page.getByRole("button", { name: "Start preparing", exact: true }).click();
  await page.getByRole("button", { name: "Mark as ready", exact: true }).click();
  await expect(page.getByTestId("order-detail-screen")).toContainText("READY");
  await expect(page.getByTestId("next-status-action-button")).toHaveCount(0);
  await expect(page.getByTestId("order-actions-bar")).toContainText(
    "Payment required before completing order handover",
  );
  await page.reload();
  await expect(page.getByTestId("payment-card")).toContainText("Unpaid");
  await expect(page.getByTestId("order-detail-screen")).toContainText("Status: READY");
  await page.getByTestId("record-payment-button").click();
  await page.getByTestId("payment-method-cash").click();
  await page.getByTestId("confirm-payment-button").click();
  await expect(page.getByTestId("record-payment-dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Complete order", exact: true }).click();
  await page.reload();
  await expect(page.getByTestId("order-detail-screen")).toContainText("COMPLETED");
  await expect(page.getByTestId("payment-card")).toContainText("Paid");
});

test("adds an expense and retains it after reload", async ({ page }) => {
  const description = `E2E flour ${randomUUID()}`;
  await page.goto("/manage/expenses");
  await page.getByTestId("add-expense-button").click();
  await page.getByTestId("expense-amount-input").fill("24.50");
  await page.getByTestId("expense-description-input").fill(description);
  await page.getByTestId("expense-submit-button").click();
  await expect(page.getByTestId("expense-sheet")).not.toBeVisible();
  await page.reload();
  await expect(page.getByTestId("expenses-list")).toContainText(description);
  await expect(page.getByTestId("expenses-list")).toContainText("24.50");
});
