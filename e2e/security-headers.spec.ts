import { type Page } from "@playwright/test";
import { expect, test, signIn } from "./fixtures";

// This suite runs against `next dev` (mock data cannot run in a production build), so the
// served CSP is the development variant. The production variant is covered by unit tests.
const STOREFRONT = [
  "/en",
  "/en/p/33333333-3333-4333-8333-333333333301",
  "/en/cart",
  "/en/checkout",
  "/en/order/tk-36",
  "/en/order/tk-36/confirmed",
  "/en/info",
];

function trackViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (/content security policy/i.test(error.message)) violations.push(error.message);
  });
  return violations;
}

test("storefront and manager responses carry the security headers", async ({ request }) => {
  for (const path of ["/en", "/manage/login"]) {
    const headers = (await request.get(path)).headers();
    const csp = headers["content-security-policy"] ?? "";
    expect(csp, path).toContain("default-src 'self'");
    expect(csp, path).toContain("frame-ancestors 'none'");
    expect(csp, path).toContain("object-src 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
  }
});

test("storefront pages produce no CSP violations", async ({ page }) => {
  const violations = trackViolations(page);
  for (const path of STOREFRONT) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(violations).toEqual([]);
});

test("manager pages produce no CSP violations", async ({ page }) => {
  const violations = trackViolations(page);
  await signIn(page);
  for (const path of ["/manage", "/manage/products", "/manage/orders", "/manage/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(violations).toEqual([]);
});
