import { defineConfig } from "vitest/config";

// Tooling tests: coverage is informative (target 60%) and kept out of the production thresholds.
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["scripts/**/*.mjs", ".github/.scripts/**/*.js"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/tooling",
    },
  },
});
