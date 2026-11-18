import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  // One worker, in file order: the mock repositories are one in-memory state inside the single dev
  // server, and every test starts from a global reset (e2e/fixtures.ts), which is only safe while
  // exactly one test runs at a time. See docs/CONTRIBUTING.md#end-to-end-tests.
  fullyParallel: false,
  forbidOnly: isCI,
  workers: 1,
  // A retry only classifies a test as flaky (reported in the job summary); it never hides one.
  retries: isCI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [
        ["list"],
        ["github"],
        ["html", { open: "never" }],
        ["json", { outputFile: "test-results/results.json" }],
      ]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    // The devcontainer has a 64 MB /dev/shm, which crashes Chromium without this flag.
    launchOptions: { args: ["--disable-dev-shm-usage"] },
    trace: "retain-on-first-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // The whole suite, as a phone (the primary target of the PWA).
      name: "mobile",
      grepInvert: /@desktop-only/,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        // Keeps screenshots and memory small; layout is unaffected.
        deviceScaleFactor: 1,
      },
    },
    {
      // Only what really differs on a wide screen: tests tagged @desktop (also run on mobile) or
      // @desktop-only (desktop alone).
      name: "desktop",
      grep: /@desktop/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: `${baseURL}/manage/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATA_SOURCE: "mock",
      // Enables POST /api/test/reset (src/lib/test-hooks.ts); set nowhere else.
      E2E_TEST_HOOKS: "1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
