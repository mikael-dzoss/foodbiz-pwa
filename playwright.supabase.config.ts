import { defineConfig, devices } from "@playwright/test";

/**
 * Anonymous storefront journey against a real local Supabase stack (DATA_SOURCE=supabase).
 * Run it with `npm run test:e2e:supabase`, which reads the stack's URL and keys from
 * `supabase status` (see scripts/e2e-supabase.mjs). It is deliberately not part of the
 * mock-mode `npm run test:e2e` suite.
 *
 * It uses `next dev`: `next build` needs the build-time Supabase read to succeed and costs a
 * full production build (about a minute and a few GB of RAM) for a single short journey.
 */
const baseURL = "http://127.0.0.1:3200";

const supabaseUrl = process.env.E2E_SUPABASE_URL ?? "";
const publishableKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? "";

export default defineConfig({
  testDir: "./e2e-supabase",
  outputDir: "test-results-supabase",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-supabase" }]],
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    // The devcontainer has a 64 MB /dev/shm, which crashes Chromium without this flag.
    launchOptions: { args: ["--disable-dev-shm-usage"] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3200",
    // /manage/login does not read the storefront catalog, so readiness never primes its cache.
    url: `${baseURL}/manage/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATA_SOURCE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      STOREFRONT_BUSINESS_ID: "11111111-1111-4111-8111-111111111111",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
