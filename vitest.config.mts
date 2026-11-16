import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    // Test default so suites that stub DATA_SOURCE=supabase satisfy the storefront business requirement.
    env: { STOREFRONT_BUSINESS_ID: "11111111-1111-4111-8111-111111111111" },
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [
      ...configDefaults.exclude,
      ...(process.env.SUPABASE_TEST_URL || process.env.npm_lifecycle_event === "test:live"
        ? []
        : ["src/**/*.contract.test.{ts,tsx}"]),
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Production code only: framework entry/metadata files and thin SDK wrappers are covered by E2E.
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/tests/**",
        "src/**/*.d.ts",
        "src/**/__fixtures__/**",
        "src/app/**/{layout,manifest,robots,sitemap}.{ts,tsx}",
        "src/app/patterns/**",
        "src/proxy.ts",
        "src/lib/supabase/**",
      ],
      reporter: ["text", "json-summary", "html"],
      // Floors: lines/functions/statements raised by scripts/coverage-ratchet.mjs (cap 70%, never lowered); branches fixed.
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 80,
        statements: 70,
      },
    },
  },
});
