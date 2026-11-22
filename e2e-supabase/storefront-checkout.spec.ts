import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import {
  DEMO_BUSINESS_ID,
  DEMO_PRODUCT,
  demoBusiness,
} from "../src/lib/repositories/mock/fixtures";

const BUSINESS_ID = DEMO_BUSINESS_ID;
const url = process.env.E2E_SUPABASE_URL ?? "";
const serviceKey = process.env.E2E_SUPABASE_SERVICE_KEY ?? "";

// Service-role client used only to make the seeded store orderable around the clock and
// restore it afterwards; the journey itself is anonymous.
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
let original: { opening_hours: string | null; min_order_amount: number } | null = null;

test.beforeAll(async () => {
  const { data, error } = await admin
    .from("business_settings")
    .select("opening_hours, min_order_amount")
    .eq("business_id", BUSINESS_ID)
    .single();
  if (error) throw error;
  original = data;
  const { error: updateError } = await admin
    .from("business_settings")
    .update({ opening_hours: "00:00 - 23:59", min_order_amount: 0 })
    .eq("business_id", BUSINESS_ID);
  if (updateError) throw updateError;

  // `next dev` compiles each route on first request; a mid-journey compile can abort a
  // navigation, so compile the journey's routes up front (after the settings change, so the
  // cached catalog already reflects it).
  const baseURL = test.info().project.use.baseURL ?? "";
  for (const path of ["/en", "/en/cart", "/en/checkout", "/en/order/0/confirmed", "/en/order/0"]) {
    await fetch(`${baseURL}${path}`);
  }
});

test.afterAll(async () => {
  if (original) {
    await admin.from("business_settings").update(original).eq("business_id", BUSINESS_ID);
  }
});

test("anonymous visitor orders from the Supabase catalog and tracks the order", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const product = DEMO_PRODUCT.boulettes;
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(demoBusiness.name);
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.getByTestId("service-mode-pickup").click();
  await page
    .getByTestId(`product-row-${product.id}`)
    .getByRole("button", { name: `Add to cart: ${product.name}`, exact: true })
    .click();
  // The cart bar only renders after hydration with the item in client state, so waiting for it
  // proves the add worked. Navigate by its href rather than a client-side click so a slow
  // dev-mode RSC fetch cannot stall the journey.
  const viewCart = page.getByRole("link", { name: /view cart/i });
  await expect(viewCart).toBeVisible();
  const cartHref = await viewCart.getAttribute("href");
  expect(cartHref).toBe("/en/cart");
  await page.goto(cartHref!);
  await expect(page.getByTestId("cart-items-list")).toContainText(product.name);

  await page.getByTestId("proceed-checkout-button").click();
  await page.getByTestId("checkout-name-input").fill("E2E Supabase Guest");
  await page.getByTestId("checkout-phone-input").fill("+33600000999");
  await page.getByTestId("place-order-button").click();

  await expect(page).toHaveURL(/\/en\/order\/[a-f0-9]{32}\/confirmed$/);
  await expect(page.getByTestId("confirmation-order-reference")).toContainText(/#\d+/);
  const token = page.url().split("/").at(-2);

  await page.getByTestId("confirmation-track-link").click();
  await expect(page).toHaveURL(`/en/order/${token}`);
  await expect(page.getByTestId("tracking-status-badge")).toBeVisible();
  await expect(page.getByTestId("tracking-summary-card")).toContainText(product.name);

  expect(pageErrors).toEqual([]);
});
