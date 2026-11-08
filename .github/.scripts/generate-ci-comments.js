#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * CI Quality Gate Report Generator (Ponytail Minimalist)
 * Generates minimal, high-signal summary comments for PRs.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const PR_NUMBER = process.env.PR_NUMBER;
const REPO = process.env.REPO;
const GH_TOKEN = process.env.GH_TOKEN;
const TITLE_STATUS = process.env.TITLE_STATUS || "skipped";
const FORMAT_STATUS = process.env.FORMAT_STATUS || "skipped";
const LINT_STATUS = process.env.LINT_STATUS || "skipped";
const TYPECHECK_STATUS = process.env.TYPECHECK_STATUS || "skipped";
const TEST_STATUS = process.env.TEST_STATUS || "skipped";
const TOOLING_STATUS = process.env.TOOLING_STATUS || "skipped";
const AUDIT_STATUS = process.env.AUDIT_STATUS || "skipped";
const BUILD_STATUS = process.env.BUILD_STATUS || "skipped";
const E2E_STATUS = process.env.E2E_STATUS || "skipped";
const DB_TEST_STATUS = process.env.DB_TEST_STATUS || "skipped";
const PR_TITLE = process.env.PR_TITLE || "";

const MARKER = "<!-- CI-BOT-GATE-SUMMARY -->";

function parseJson(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return null;
  }
}

function getUnformattedFiles() {
  try {
    const prettierBin = path.resolve(process.cwd(), "node_modules/.bin/prettier");
    const cmd = fs.existsSync(prettierBin)
      ? `"${prettierBin}" --list-different .`
      : "npx --no-install prettier --list-different .";
    const out = execSync(cmd, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return out
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
  } catch (error) {
    if (error.stdout) {
      return error.stdout
        .toString()
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);
    }
    return [];
  }
}

function computeLayerCoverage(coverage, prefix) {
  const files = Object.keys(coverage).filter((k) => k !== "total" && k.includes(prefix));
  if (files.length === 0) return null;

  let totalLines = 0,
    coveredLines = 0;
  let totalBranches = 0,
    coveredBranches = 0;
  let totalFuncs = 0,
    coveredFuncs = 0;

  for (const f of files) {
    totalLines += coverage[f].lines.total;
    coveredLines += coverage[f].lines.covered;
    totalBranches += coverage[f].branches.total;
    coveredBranches += coverage[f].branches.covered;
    totalFuncs += coverage[f].functions.total;
    coveredFuncs += coverage[f].functions.covered;
  }

  return {
    lines: totalLines > 0 ? ((coveredLines / totalLines) * 100).toFixed(1) : "100.0",
    branches: totalBranches > 0 ? ((coveredBranches / totalBranches) * 100).toFixed(1) : "100.0",
    functions: totalFuncs > 0 ? ((coveredFuncs / totalFuncs) * 100).toFixed(1) : "100.0",
  };
}

function buildCoverageTable(coverage, toolingCoverage) {
  if (!coverage || !coverage.total) return "";

  const layers = [
    { name: "Domain Core", prefix: "src/domain", target: 85 },
    { name: "Features", prefix: "src/features", target: 80 },
    { name: "Shared Lib", prefix: "src/lib", target: 75 },
    { name: "Config & Env", prefix: "src/config", target: 80 },
    { name: "Components", prefix: "src/components", target: 70 },
    { name: "App Router", prefix: "src/app", target: 70 },
  ];

  let out = `### 📊 Test Coverage Report\n\n`;
  out += `| Layer | Target | Lines | Branches | Functions | Status |\n`;
  out += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const layer of layers) {
    const stats = computeLayerCoverage(coverage, layer.prefix);
    if (!stats) continue;
    const ok = Number(stats.lines) >= layer.target && Number(stats.branches) >= layer.target;
    out += `| **${layer.name}** | ${layer.target}% | ${stats.lines}% | ${stats.branches}% | ${stats.functions}% | ${ok ? "🎯 Optimal" : "⚠️ Sub-threshold"} |\n`;
  }

  const totalLines = coverage.total.lines.pct;
  const totalBranches = coverage.total.branches.pct;
  const totalFuncs = coverage.total.functions.pct;
  const totalOk = totalLines >= 70 && totalBranches >= 70;

  out += `| **Total Project** | **70%** | **${totalLines}%** | **${totalBranches}%** | **${totalFuncs}%** | ${totalOk ? "✅ Passed" : "⚠️ In Progress"} |\n`;

  if (toolingCoverage && toolingCoverage.total) {
    const t = toolingCoverage.total;
    const toolingOk = t.lines.pct >= 60;
    out += `| _Tooling (informative)_ | 60% | ${t.lines.pct}% | ${t.branches.pct}% | ${t.functions.pct}% | ${toolingOk ? "ℹ️ On target" : "ℹ️ Below target"} |\n`;
  }

  return out + "\n";
}

function buildCommentBody(options = {}) {
  const titleStatus = options.titleStatus || TITLE_STATUS;
  const formatStatus = options.formatStatus || FORMAT_STATUS;
  const lintStatus = options.lintStatus || LINT_STATUS;
  const typecheckStatus = options.typecheckStatus || TYPECHECK_STATUS;
  const testStatus = options.testStatus || TEST_STATUS;
  const toolingStatus = options.toolingStatus || TOOLING_STATUS;
  const auditStatus = options.auditStatus || AUDIT_STATUS;
  const buildStatus = options.buildStatus || BUILD_STATUS;
  const e2eStatus = options.e2eStatus || E2E_STATUS;
  const dbTestStatus = options.dbTestStatus || DB_TEST_STATUS;
  const prTitle = options.prTitle || PR_TITLE;

  const isSuccess =
    (titleStatus === "success" || titleStatus === "skipped") &&
    (formatStatus === "success" || formatStatus === "skipped") &&
    (lintStatus === "success" || lintStatus === "skipped") &&
    (typecheckStatus === "success" || typecheckStatus === "skipped") &&
    (testStatus === "success" || testStatus === "skipped") &&
    (toolingStatus === "success" || toolingStatus === "skipped") &&
    (auditStatus === "success" || auditStatus === "skipped") &&
    (buildStatus === "success" || buildStatus === "skipped") &&
    (e2eStatus === "success" || e2eStatus === "skipped") &&
    (dbTestStatus === "success" || dbTestStatus === "skipped");

  const coverage =
    options.coverage !== undefined ? options.coverage : parseJson("coverage/coverage-summary.json");
  const toolingCoverage =
    options.toolingCoverage !== undefined
      ? options.toolingCoverage
      : parseJson("coverage/tooling/coverage-summary.json");
  const testResults = parseJson("coverage/test-results.json");

  let body = `${MARKER}\n## 🤖 CI Quality Gate Report\n\n`;

  if (isSuccess) {
    body += `> [!NOTE]\n> **All Quality Checks Passed!** Code formatting, linting, typecheck, tests, browser/accessibility checks, security audit, and Next.js build are satisfied.\n\n`;
    body += buildCoverageTable(coverage, toolingCoverage);
    return body;
  }

  // Failure output: Only the step that failed with minimum required details
  if (titleStatus === "failure") {
    body += `> [!WARNING]\n`;
    body += `> **PR Title Check Failed**\n>\n`;
    body += `> Received: \`${prTitle}\`\n>\n`;
    body += `> **Expected format:** \`<type>(<scope>): <description>\` or \`<type>: <description>\`\n`;
    body += `> - **Allowed Types**: \`feat\`, \`fix\`, \`refactor\`, \`docs\`, \`test\`, \`chore\`, \`ci\`, \`build\`, \`perf\`, \`style\`\n`;
    body += `> - **Allowed Scopes**: e.g., \`orders\`, \`products\`, \`expenses\`, \`domain\`, \`storefront\`, \`dashboard\`, \`auth\`\n`;
    body += `> - **Example**: \`feat(orders): add status filter tabs\`\n\n`;
  }

  if (formatStatus === "failure") {
    const unformattedFiles =
      options.unformattedFiles !== undefined
        ? options.unformattedFiles
        : process.env.UNFORMATTED_FILES !== undefined
          ? process.env.UNFORMATTED_FILES.split("\n")
              .map((f) => f.trim())
              .filter(Boolean)
          : getUnformattedFiles();

    if (unformattedFiles && unformattedFiles.length > 0) {
      const countLabel =
        unformattedFiles.length === 1
          ? "1 file needs formatting"
          : `${unformattedFiles.length} files need formatting`;
      body += `> [!WARNING]\n`;
      body += `> **Code Formatting Check Failed (${countLabel})**\n>\n`;
      body += `> The following files do not match Prettier standards:\n`;
      const displayed = unformattedFiles.slice(0, 50);
      for (const f of displayed) {
        body += `> - ❌ \`${f}\`\n`;
      }
      if (unformattedFiles.length > 50) {
        body += `> - ... and ${unformattedFiles.length - 50} more files\n`;
      }
      body += `>\n> Run \`npm run format\` locally to format all files automatically.\n\n`;
    } else {
      body += `> [!WARNING]\n`;
      body += `> **Code Formatting Check Failed**\n>\n`;
      body += `> Code formatting does not match Prettier standards.\n`;
      body += `> Run \`npm run format\` locally to format all files automatically.\n\n`;
    }
  }

  if (lintStatus === "failure") {
    body += `> [!WARNING]\n`;
    body += `> **ESLint Check Failed**\n>\n`;
    body += `> ESLint reported code style or convention issues.\n`;
    body += `> Run \`npm run lint\` locally to inspect and resolve warnings/errors.\n\n`;
  }

  if (typecheckStatus === "failure") {
    body += `> [!WARNING]\n`;
    body += `> **TypeScript Typecheck Failed**\n>\n`;
    body += `> Strict TypeScript compilation (\`tsc --noEmit\`) failed.\n`;
    body += `> Run \`npm run typecheck\` locally to view compiler diagnostics.\n\n`;
  }

  if (testStatus === "failure") {
    const failedTests = [];
    if (testResults && testResults.testResults) {
      for (const file of testResults.testResults) {
        for (const assertion of file.assertionResults || []) {
          if (assertion.status === "failed") {
            const suite = assertion.ancestorTitles?.join(" > ") || "";
            failedTests.push(suite ? `${suite} > ${assertion.title}` : assertion.title);
          }
        }
      }
    }

    if (failedTests.length > 0) {
      body += `> [!WARNING]\n`;
      body += `> **Unit Tests Failed (${failedTests.length} failing)**\n>\n`;
      for (const t of failedTests) {
        body += `> - ❌ \`${t}\`\n`;
      }
      body += `>\n> Run \`npm run test\` locally to debug failing tests.\n\n`;
    } else {
      body += `> [!WARNING]\n`;
      body += `> **Unit Tests Failed**\n>\n`;
      body += `> Test execution failed. Run \`npm run test\` locally to inspect failures.\n\n`;
    }
  }

  if (toolingStatus === "failure") {
    body += `> [!WARNING]\n`;
    body += `> **Tooling Tests Failed**\n>\n`;
    body += `> Run \`npm run test:tooling\` locally to debug failing tooling tests.\n\n`;
  }

  if (e2eStatus !== "success" && e2eStatus !== "skipped") {
    body += `> [!WARNING]\n`;
    body += `> **Playwright & Accessibility Checks Did Not Pass**\n>\n`;
    body += `> Run \`npm run test:e2e\` locally. Download the \`playwright-results\` artifact for traces, screenshots, and the HTML report.\n\n`;
  }

  if (auditStatus === "failure") {
    body += `> [!WARNING]\n`;
    body += `> **Production Dependency Audit Failed**\n>\n`;
    body += `> High or critical vulnerabilities detected in production dependencies.\n`;
    body += `> Run \`npm audit --audit-level=high --omit=dev\` locally to review affected packages.\n\n`;
  }

  if (buildStatus === "failure") {
    body += `> [!WARNING]\n`;
    body += `> **Next.js Production Build Failed**\n>\n`;
    body += `> The Next.js production build failed.\n`;
    body += `> Run \`npm run build\` locally to reproduce and fix build errors.\n\n`;
  }

  if (dbTestStatus === "failure") {
    body += `> [!WARNING]\n`;
    body += `> **Database Tests (pgTAP) Failed**\n>\n`;
    body += `> Run \`npm run db:test\` locally to inspect database test failures.\n\n`;
  }

  return body;
}

function postOrUpdateComment(prNumber, commentBody) {
  if (!prNumber || !REPO || !GH_TOKEN) {
    console.log("No PR environment detected. Outputting report to stdout:\n");
    console.log(commentBody);
    return;
  }

  try {
    const commentsRaw = execSync(
      `gh api repos/${REPO}/issues/${prNumber}/comments --jq '.[] | {id: .id, body: .body}'`,
      { encoding: "utf8", env: { ...process.env, GH_TOKEN } },
    ).trim();

    let existingCommentId = null;
    if (commentsRaw) {
      for (const line of commentsRaw.split("\n")) {
        if (!line.trim()) continue;
        try {
          const c = JSON.parse(line);
          if (c.body && c.body.includes(MARKER)) {
            existingCommentId = c.id;
            break;
          }
        } catch {
          // ignore single line json parse error
        }
      }
    }

    const tmpFile = path.resolve(process.cwd(), ".ci-comment.tmp");
    fs.writeFileSync(tmpFile, commentBody, "utf8");

    if (existingCommentId) {
      console.log(`Updating comment #${existingCommentId} on PR #${prNumber}...`);
      execSync(
        `gh api -X PATCH repos/${REPO}/issues/comments/${existingCommentId} -F body=@${tmpFile}`,
        { stdio: "inherit", env: { ...process.env, GH_TOKEN } },
      );
    } else {
      console.log(`Posting new comment on PR #${prNumber}...`);
      execSync(`gh pr comment ${prNumber} --body-file ${tmpFile}`, {
        stdio: "inherit",
        env: { ...process.env, GH_TOKEN },
      });
    }
    fs.unlinkSync(tmpFile);
    console.log("CI comment updated successfully.");
  } catch (error) {
    console.error("Failed to post/update PR comment:", error.message);
  }
}

function saveReport(targetDir, prNumber) {
  const commentBody = buildCommentBody();
  fs.mkdirSync(targetDir, { recursive: true });

  const commentFile = path.join(targetDir, "comment.md");
  fs.writeFileSync(commentFile, commentBody, "utf8");
  console.log(`Saved CI comment to ${commentFile}`);

  const pr = prNumber || process.env.PR_NUMBER || PR_NUMBER;
  if (pr) {
    const prFile = path.join(targetDir, "pr_number.txt");
    fs.writeFileSync(prFile, String(pr), "utf8");
    console.log(`Saved PR number (${pr}) to ${prFile}`);
  }

  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary && fs.existsSync(path.dirname(stepSummary))) {
    try {
      fs.appendFileSync(stepSummary, `\n${commentBody}\n`, "utf8");
    } catch {
      // ignore step summary errors
    }
  }
}

function publishFromDir(sourceDir) {
  const commentFile = path.join(sourceDir, "comment.md");
  const prFile = path.join(sourceDir, "pr_number.txt");

  if (!fs.existsSync(commentFile) || !fs.existsSync(prFile)) {
    console.log("No PR report files found in directory; skipping comment publish.");
    return;
  }

  const prNumber = fs.readFileSync(prFile, "utf8").trim();
  const commentBody = fs.readFileSync(commentFile, "utf8");

  if (!/^\d+$/.test(prNumber)) {
    console.warn(`Invalid PR number '${prNumber}'; skipping comment publish.`);
    return;
  }

  postOrUpdateComment(prNumber, commentBody);
}

function publishComment() {
  const commentBody = buildCommentBody();
  postOrUpdateComment(PR_NUMBER, commentBody);
}

if (require.main === module) {
  const saveIdx = process.argv.indexOf("--save-report");
  const publishIdx = process.argv.indexOf("--publish-from");

  if (saveIdx !== -1 && process.argv[saveIdx + 1]) {
    saveReport(path.resolve(process.cwd(), process.argv[saveIdx + 1]));
  } else if (publishIdx !== -1 && process.argv[publishIdx + 1]) {
    publishFromDir(path.resolve(process.cwd(), process.argv[publishIdx + 1]));
  } else {
    publishComment();
  }
}

module.exports = {
  buildCommentBody,
  publishComment,
  saveReport,
  publishFromDir,
  getUnformattedFiles,
};
