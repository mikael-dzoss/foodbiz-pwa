import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// The browser runs in Auckland (UTC+12/13); the business operates in Europe/Paris (the demo
// default). Server render and hydration must both show Paris time (#168).
test.use({ timezoneId: "Pacific/Auckland", locale: "en-GB" });

const parisTime = (at: Date): string =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);

test("order detail shows the business time zone and hydrates cleanly", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));

  const suffix = randomUUID().replace(/\D/g, "").padEnd(8, "0").slice(0, 8);
  await page.goto("/manage/login");
  await page.getByTestId("btn-demo-sign-in").click();
  await expect(page).toHaveURL("/manage");

  await page.goto("/manage/orders/new");
  await page.getByTestId("guest-phone-input").fill(`+336${suffix}`);
  await page.getByTestId("guest-name-input").fill(`Tz Guest ${suffix}`);
  await page
    .getByTestId("product-row-33333333-3333-4333-8333-333333333301")
    .getByRole("button", { name: "Increase quantity" })
    .click();
  const before = new Date();
  await page.getByTestId("create-order-submit-button").click();
  await page.getByTestId("confirm-create-order-button").click();
  await expect(page).toHaveURL(/\/manage\/orders\/[a-f0-9-]+$/);
  const orderUrl = page.url();
  const after = new Date();

  // A fresh document load: server-rendered HTML, then hydration, in an Auckland browser
  await page.goto(orderUrl);
  const created = page.getByText(/^Created on /);
  await expect(created).toBeVisible();
  const text = (await created.textContent()) ?? "";
  const shown = /at (\d{2}:\d{2})/.exec(text)?.[1];

  // Paris minutes between the request and the page load (a minute of slack either side)
  const allowed = new Set<string>();
  for (let t = before.getTime() - 60_000; t <= after.getTime() + 60_000; t += 30_000) {
    allowed.add(parisTime(new Date(t)));
  }
  expect(allowed.has(shown ?? "")).toBe(true);

  // Never the browser's own (Auckland) wall clock
  const auckland = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Pacific/Auckland",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(before);
  expect(shown).not.toBe(auckland);

  expect(problems.filter((p) => /hydrat|did not match|server rendered/i.test(p))).toEqual([]);
});
