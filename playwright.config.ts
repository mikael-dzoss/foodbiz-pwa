import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    // The devcontainer has a 64 MB /dev/shm, which crashes Chromium without this flag.
    launchOptions: { args: ["--disable-dev-shm-usage"] },
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: `${baseURL}/manage/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATA_SOURCE: "mock",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
