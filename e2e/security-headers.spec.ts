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

test("storefront and manager HTML link their separate manifests and both return 200", async ({
  request,
}) => {
  const storefrontHtml = await (await request.get("/en")).text();
  expect(storefrontHtml).toMatch(
    /<link\b[^>]*rel="manifest"[^>]*href="\/en\/manifest\.webmanifest"/,
  );
  expect(storefrontHtml).toMatch(
    /<meta\b[^>]*name="apple-mobile-web-app-title"[^>]*content="Les Saveurs du Continent"/,
  );

  const managerHtml = await (await request.get("/manage/login")).text();
  expect(managerHtml).toMatch(
    /<link\b[^>]*rel="manifest"[^>]*href="\/manage\/manifest\.webmanifest"/,
  );
  expect(managerHtml).toMatch(
    /<meta\b[^>]*name="apple-mobile-web-app-title"[^>]*content="FoodBiz"/,
  );

  const storefrontRes = await request.get("/en/manifest.webmanifest", { maxRedirects: 0 });
  expect(storefrontRes.status()).toBe(200);
  expect(storefrontRes.headers()["content-type"]).toContain("application/manifest+json");
  const storefrontManifest = (await storefrontRes.json()) as Record<string, unknown>;
  expect(storefrontManifest.id).toBe("/");
  expect(storefrontManifest.scope).toBe("/");
  expect(storefrontManifest.start_url).toBe("/en");

  const managerRes = await request.get("/manage/manifest.webmanifest", { maxRedirects: 0 });
  expect(managerRes.status()).toBe(200);
  expect(managerRes.headers()["content-type"]).toContain("application/manifest+json");
  const managerManifest = (await managerRes.json()) as Record<string, unknown>;
  expect(managerManifest.id).toBe("/manage");
  expect(managerManifest.scope).toBe("/manage");
  expect(managerManifest.start_url).toBe("/manage");
  expect(managerManifest.name).toBe("FoodBiz Manager");

  const unknownLocaleRes = await request.get("/de/manifest.webmanifest", { maxRedirects: 0 });
  expect(unknownLocaleRes.status()).toBe(404);
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
