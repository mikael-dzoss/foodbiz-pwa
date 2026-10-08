// @vitest-environment node
import { describe, expect, it } from "vitest";
import ci from "../.github/.scripts/generate-ci-comments.js";

const passing = {
  titleStatus: "success",
  formatStatus: "success",
  lintStatus: "success",
  typecheckStatus: "success",
  testStatus: "success",
  toolingStatus: "success",
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
});
