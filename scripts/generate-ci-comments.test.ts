// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ci from "../.github/.scripts/generate-ci-comments.js";

const passing = {
  titleStatus: "success",
  formatStatus: "success",
  lintStatus: "success",
  typecheckStatus: "success",
  testStatus: "success",
  toolingStatus: "success",
  e2eStatus: "success",
  auditStatus: "success",
  buildStatus: "success",
  coverage: null,
  toolingCoverage: null,
};

const summary = (pct: number) => ({
  total: { lines: { pct }, branches: { pct }, functions: { pct } },
});

describe("CI comment generator", () => {
  it("reports success with the summary marker", () => {
    const body = ci.buildCommentBody(passing);
    expect(body).toContain("<!-- CI-BOT-GATE-SUMMARY -->");
    expect(body).toContain("All Quality Checks Passed");
  });

  it("lists only failed steps", () => {
    const body = ci.buildCommentBody({ ...passing, lintStatus: "failure", buildStatus: "failure" });
    expect(body).toContain("ESLint Check Failed");
    expect(body).toContain("Next.js Production Build Failed");
    expect(body).not.toContain("All Quality Checks Passed");
    expect(body).not.toContain("Typecheck Failed");
  });

  it("echoes the rejected PR title", () => {
    const body = ci.buildCommentBody({
      ...passing,
      titleStatus: "failure",
      prTitle: "update stuff",
    });
    expect(body).toContain("Received: `update stuff`");
  });

  it("treats skipped steps as passing", () => {
    expect(ci.buildCommentBody({ ...passing, auditStatus: "skipped" })).toContain(
      "All Quality Checks Passed",
    );
  });

  it("reports failing tooling tests", () => {
    const body = ci.buildCommentBody({ ...passing, toolingStatus: "failure" });
    expect(body).toContain("Tooling Tests Failed");
    expect(body).not.toContain("All Quality Checks Passed");
  });

  it.each(["failure", "cancelled"])(
    "does not report success when browser checks are %s",
    (e2eStatus) => {
      const body = ci.buildCommentBody({ ...passing, e2eStatus });
      expect(body).toContain("Playwright & Accessibility Checks Did Not Pass");
      expect(body).toContain("npm run test:e2e");
      expect(body).not.toContain("All Quality Checks Passed");
    },
  );

  it("shows tooling coverage as an informative row against 60%", () => {
    const onTarget = ci.buildCommentBody({
      ...passing,
      coverage: summary(90),
      toolingCoverage: summary(62),
    });
    expect(onTarget).toContain("| **Total Project** | **70%** | **90%**");
    expect(onTarget).toContain("| _Tooling (informative)_ | 60% | 62% |");
    expect(onTarget).toContain("On target");
    const below = ci.buildCommentBody({
      ...passing,
      coverage: summary(90),
      toolingCoverage: summary(40),
    });
    expect(below).toContain("Below target");
    expect(below).toContain("All Quality Checks Passed");
  });

  it("omits the tooling row without tooling coverage", () => {
    expect(ci.buildCommentBody({ ...passing, coverage: summary(90) })).not.toContain("Tooling");
  });

  it("lists unformatted files when formatStatus is failure", () => {
    const body = ci.buildCommentBody({
      ...passing,
      formatStatus: "failure",
      unformattedFiles: [".mcp.json", "docs/design/DESIGN_SYSTEM.md"],
    });
    expect(body).toContain("Code Formatting Check Failed (2 files need formatting)");
    expect(body).toContain("The following files do not match Prettier standards:");
    expect(body).toContain("- ❌ `.mcp.json`");
    expect(body).toContain("- ❌ `docs/design/DESIGN_SYSTEM.md`");
    expect(body).toContain("Run `npm run format` locally to format all files automatically.");
  });

  it("handles singular wording when exactly 1 file needs formatting", () => {
    const body = ci.buildCommentBody({
      ...passing,
      formatStatus: "failure",
      unformattedFiles: [".mcp.json"],
    });
    expect(body).toContain("Code Formatting Check Failed (1 file needs formatting)");
    expect(body).toContain("- ❌ `.mcp.json`");
  });

  it("falls back to generic warning when formatStatus is failure and no files are found", () => {
    const body = ci.buildCommentBody({
      ...passing,
      formatStatus: "failure",
      unformattedFiles: [],
    });
    expect(body).toContain("Code Formatting Check Failed");
    expect(body).toContain("Code formatting does not match Prettier standards.");
    expect(body).toContain("Run `npm run format` locally to format all files automatically.");
    expect(body).not.toContain("The following files do not match Prettier standards:");
  });

  it("caps listed unformatted files if list exceeds 50", () => {
    const manyFiles = Array.from({ length: 55 }, (_, i) => `file-${i}.ts`);
    const body = ci.buildCommentBody({
      ...passing,
      formatStatus: "failure",
      unformattedFiles: manyFiles,
    });
    expect(body).toContain("Code Formatting Check Failed (55 files need formatting)");
    expect(body).toContain("- ❌ `file-0.ts`");
    expect(body).toContain("- ❌ `file-49.ts`");
    expect(body).toContain("- ... and 5 more files");
    expect(body).not.toContain("- ❌ `file-50.ts`");
  });

  it("exports getUnformattedFiles which returns array of strings", () => {
    expect(typeof ci.getUnformattedFiles).toBe("function");
    const files = ci.getUnformattedFiles();
    expect(Array.isArray(files)).toBe(true);
  }, 60000);

  it("exports saveReport and writes comment.md and pr_number.txt", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ci-report-test-"));
    process.env.PR_NUMBER = "123";
    try {
      ci.saveReport(tmpDir);
      expect(fs.existsSync(path.join(tmpDir, "comment.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "pr_number.txt"))).toBe(true);
      const pr = fs.readFileSync(path.join(tmpDir, "pr_number.txt"), "utf8");
      expect(pr).toBe("123");
    } finally {
      delete process.env.PR_NUMBER;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("exports publishFromDir and skips safely if files missing or invalid", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ci-report-test-"));
    try {
      // Missing files
      expect(() => ci.publishFromDir(tmpDir)).not.toThrow();

      // Invalid PR number
      fs.writeFileSync(path.join(tmpDir, "comment.md"), "test body");
      fs.writeFileSync(path.join(tmpDir, "pr_number.txt"), "not-a-number");
      expect(() => ci.publishFromDir(tmpDir)).not.toThrow();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
