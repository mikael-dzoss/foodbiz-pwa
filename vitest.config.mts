import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Production code only: framework entry/metadata files and thin SDK wrappers are covered by E2E.
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/**/__fixtures__/**",
        "src/app/**/{layout,manifest,robots,sitemap}.{ts,tsx}",
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
