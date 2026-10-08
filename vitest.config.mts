import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/app/**/layout.tsx", "src/proxy.ts"],
      reporter: ["text", "json-summary", "html"],
      // Ratchet: fails below these values, raises them when coverage improves (commit the change).
      thresholds: {
        autoUpdate: (newThreshold: number) => Math.floor(newThreshold),
        lines: 27,
        functions: 20,
        branches: 100,
        statements: 29,
      },
    },
  },
});
