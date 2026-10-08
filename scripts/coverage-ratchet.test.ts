// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ratchet } from "./coverage-ratchet.mjs";

const config = `export default {
  test: {
    coverage: {
      thresholds: {
        lines: 27,
        functions: 20,
        branches: 80,
        statements: 29,
      },
    },
  },
};`;

const totals = (pct: number, branches = pct) => ({
  lines: { pct },
  functions: { pct },
  statements: { pct },
  branches: { pct: branches },
});

describe("coverage ratchet", () => {
  it("raises thresholds to floored coverage", () => {
    const result = ratchet(config, totals(45.9));
    expect(result.config).toContain("lines: 45,");
    expect(result.config).toContain("functions: 45,");
    expect(result.config).toContain("statements: 45,");
    expect(result.changes).toEqual(["lines: 27 → 45", "functions: 20 → 45", "statements: 29 → 45"]);
  });

  it("caps thresholds at 70%", () => {
    expect(ratchet(config, totals(98)).config).toContain("lines: 70,");
  });

  it("never lowers thresholds", () => {
    const result = ratchet(config, totals(10));
    expect(result.config).toBe(config);
    expect(result.changes).toEqual([]);
  });

  it("keeps an explicit threshold above the cap", () => {
    expect(ratchet(config.replace("lines: 27", "lines: 75"), totals(90)).config).toContain(
      "lines: 75,",
    );
  });

  it("never touches branches", () => {
    expect(ratchet(config, totals(60, 10)).config).toContain("branches: 80,");
    expect(ratchet(config, totals(60, 100)).config).toContain("branches: 80,");
  });

  it("only edits inside the thresholds block", () => {
    const withReporter = `const lines: 5 = 5;\n${config}`;
    expect(ratchet(withReporter, totals(50)).config).toContain("const lines: 5 = 5;");
  });

  it("fails loudly when thresholds are missing", () => {
    expect(() => ratchet("export default {}", totals(50))).toThrow("thresholds not found");
    expect(() => ratchet("thresholds: { lines: 1 }", totals(50))).toThrow('"functions" not found');
  });
});
