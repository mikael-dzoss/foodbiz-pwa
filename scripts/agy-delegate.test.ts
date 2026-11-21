// @vitest-environment node
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  LOCK_STALE_MS,
  ROLES,
  UsageError,
  buildAgyArgs,
  coerceReport,
  decide,
  durationMs,
  formatSummary,
  gateDefiningFiles,
  gitFacts,
  main,
  parseArgs,
  reportFromText,
  requiredStepsFor,
  withGateLock,
} from "./agy-delegate.mjs";

const cleanReport = {
  status: "done" as const,
  summary: "Added the order filter.",
  pr_url: "",
  blockers: [],
  follow_ups: [],
};

const cleanFacts = {
  head: "abc1234567890abcdef1234567890abcdef12345",
  branch: "feature/42-filter",
  commits: ["abc1234 feat(orders): status filter"],
  files: ["src/features/orders/filter.tsx"],
  dirty: [],
  note: "",
};

const matchingReceipt = {
  head: cleanFacts.head,
  steps: ["format:check", "lint", "typecheck", "test"],
  mode: "quick",
  at: "2026-11-21T12:00:00.000Z",
};

const agyResult = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    conversation_id: "c-1",
    status: "SUCCESS",
    response: "ok",
    duration_seconds: 12.4,
    num_turns: 3,
    structured_output: cleanReport,
    usage: { input_tokens: 20000, output_tokens: 900, cache_read_tokens: 15000 },
    ...overrides,
  });

const successProc = (structured: unknown = cleanReport, extra: Record<string, unknown> = {}) => ({
  status: 0,
  stdout: agyResult({ structured_output: structured, ...extra }),
  stderr: "",
});

describe("parseArgs", () => {
  it("defaults tier, timeout, base and resolves cwd", () => {
    const opts = parseArgs(["frontend", "--brief", "b.md", "--cwd", "/tmp/w"]);
    expect(opts).toMatchObject({
      role: "frontend",
      brief: "b.md",
      cwd: "/tmp/w",
      base: "origin/develop",
      tier: "high",
      timeout: "45m",
    });
    expect(parseArgs(["ops", "--brief", "b.md"]).tier).toBe("medium");
  });

  it("accepts escalation tiers, resume and --base", () => {
    const opts = parseArgs([
      "backend",
      "--brief",
      "b.md",
      "--base",
      "feature/parent",
      "--tier",
      "xhigh",
      "--resume",
      "c-1",
      "--timeout",
      "90s",
    ]);
    expect(opts).toMatchObject({
      base: "feature/parent",
      tier: "xhigh",
      resume: "c-1",
      timeout: "90s",
    });
  });

  it.each([
    [[], /unknown role/],
    [["design", "--brief", "b"], /unknown role/],
    [["frontend"], /--brief is required/],
    [["frontend", "--brief"], /bad argument/],
    [["frontend", "--brief", "b", "--base"], /bad argument/],
    [["frontend", "--brief", "b", "--base", "-x"], /--base/],
    [["frontend", "--brief", "b", "--base", "--exec=evil"], /--base/],
    [["frontend", "--brief", "b", "--base", "origin/dev;id"], /--base/],
    [["frontend", "--brief", "b", "--base", "has space"], /--base/],
    [["frontend", "--brief", "b", "--base", ""], /--base/],
    [["frontend", "--brief", "b", "--nope", "x"], /bad argument/],
    [["fast", "--brief", "b", "--tier", "xhigh"], /no tier 'xhigh'/],
    [["ops", "--brief", "b", "--timeout", "10"], /--timeout/],
  ])("rejects %j", (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(UsageError);
    expect(() => parseArgs(argv)).toThrow(message);
  });
});

describe("ROLES", () => {
  it("uses 4th-gen models at high reasoning for implementation and flash for ops", () => {
    expect(ROLES.frontend.tiers.high).toBe("gemini-4-neon-high");
    expect(ROLES.backend.tiers.xhigh).toBe("gemini-4-neon-xhigh");
    expect(ROLES.fast.tiers.high).toBe("gemini-4-hydrogen-high");
    expect(ROLES.ops.tiers.medium).toBe("gemini-3.8-flash-medium");
  });
});

describe("durationMs", () => {
  it("converts h, m and s", () => {
    expect(durationMs("1h")).toBe(3_600_000);
    expect(durationMs("45m")).toBe(2_700_000);
    expect(durationMs("90s")).toBe(90_000);
  });
});

describe("buildAgyArgs", () => {
  it("runs the role's agent headless with the report schema", () => {
    const args = buildAgyArgs(parseArgs(["frontend", "--brief", "b"]), "PROMPT");
    expect(args.slice(0, 6)).toEqual([
      "-p",
      "PROMPT",
      "--agent",
      "foodbiz-frontend",
      "--model",
      "gemini-4-neon-high",
    ]);
    expect(args).toContain("--dangerously-skip-permissions");
    expect(args[args.indexOf("--json-schema") + 1]).toMatch(/scripts\/agy-report\.schema\.json$/);
    expect(args).not.toContain("--conversation");
  });

  it("resumes a conversation", () => {
    const args = buildAgyArgs(parseArgs(["backend", "--brief", "b", "--resume", "c-9"]), "fix");
    expect(args.slice(-2)).toEqual(["--conversation", "c-9"]);
  });
});

describe("coerceReport", () => {
  it("coerces valid input and drops legacy keys", () => {
    expect(
      coerceReport({
        status: "done",
        summary: "Shipped it.",
        branch: "feature/x",
        commit: "abc1234",
        commits: [{ sha: "abc" }],
        files_changed: ["src/a.ts"],
        checks_run: [{ command: "npm run gate:quick", result: "pass", notes: "" }],
        pr_url: "https://github.com/org/repo/pull/1",
        blockers: [],
        follow_ups: ["clean up"],
      }),
    ).toEqual({
      status: "done",
      summary: "Shipped it.",
      pr_url: "https://github.com/org/repo/pull/1",
      blockers: [],
      follow_ups: ["clean up"],
    });
  });

  it("maps unknown status to blocked and returns null when status is missing", () => {
    expect(coerceReport({ status: "denied", blockers: ["hook"], pr_url: null })).toEqual({
      status: "blocked",
      summary: "",
      pr_url: "",
      blockers: ["hook"],
      follow_ups: [],
    });
    expect(coerceReport(null)).toBeNull();
    expect(coerceReport({ summary: "no status" })).toBeNull();
    expect(coerceReport(["done"])).toBeNull();
  });
});

describe("reportFromText", () => {
  it("parses preamble + unfenced JSON", () => {
    const text =
      'Ran the checks and committed.\n{"status":"done","summary":"Fixed bug.","blockers":[],"follow_ups":[]}';
    expect(reportFromText(text)).toEqual({
      status: "done",
      summary: "Fixed bug.",
      pr_url: "",
      blockers: [],
      follow_ups: [],
    });
  });

  it("parses preamble + fenced JSON", () => {
    const text =
      'Here is the final report.\n```json\n{"status":"done","summary":"Done via fence."}\n```';
    expect(reportFromText(text)).toEqual({
      status: "done",
      summary: "Done via fence.",
      pr_url: "",
      blockers: [],
      follow_ups: [],
    });
  });

  it("accepts legacy keys like commit and object commits while ignoring them", () => {
    const text = [
      "Done.",
      JSON.stringify({
        status: "done",
        summary: "Updated URL helper.",
        commit: "abc1234",
        commits: [{ sha: "abc1234", message: "fix" }],
        checks_run: [{ command: "npm run gate:quick", status: "pass" }],
        files_changed: ["src/a.ts"],
        branch: "bug/1",
      }),
    ].join("\n");
    expect(reportFromText(text)).toEqual({
      status: "done",
      summary: "Updated URL helper.",
      pr_url: "",
      blockers: [],
      follow_ups: [],
    });
  });

  it("prefers the enclosing report over a nested object with a status key", () => {
    const text =
      'Summary follows.\n{"status":"blocked","summary":"outer","checks_run":[{"command":"gate","status":"denied"}],"blockers":["failed"]}';
    expect(reportFromText(text)).toEqual({
      status: "blocked",
      summary: "outer",
      pr_url: "",
      blockers: ["failed"],
      follow_ups: [],
    });
  });

  it("returns null without a JSON object that has a status", () => {
    expect(reportFromText("no json here")).toBeNull();
    expect(reportFromText('```json\n{"summary":"x"}\n```')).toBeNull();
    expect(reportFromText(undefined)).toBeNull();
  });

  it("recovers reports from inline replay fixtures of real agy outputs", () => {
    // Trimmed from .claude/state/agy/2026-11-20T21-53-34-220Z-fast.json
    const replayFast1 = [
      "Formatted the changed files and running `npm run gate:quick`; waiting for it to finish.",
      JSON.stringify(
        {
          status: "done",
          branch: "bug/304-settings-shop-url",
          commit: "dcf606b",
          summary:
            "Moved the storefront link preview and copy button into a standalone row below the slug field.",
          files_changed: ["src/features/settings/components/business-profile-form.tsx"],
          checks: ["npm run gate:quick (all PASS)"],
          blockers: [],
          follow_ups: [],
        },
        null,
        2,
      ),
      JSON.stringify(
        {
          status: "done",
          branch: "bug/304-settings-shop-url",
          commit: "dcf606b",
          summary:
            "Moved the storefront link preview and copy button into a standalone row below the slug field.",
          files_changed: ["src/features/settings/components/business-profile-form.tsx"],
          checks: ["npm run gate:quick (all PASS)"],
          blockers: [],
          follow_ups: [],
        },
        null,
        2,
      ),
    ].join("\n");

    // Trimmed from .claude/state/agy/2026-11-20T21-20-51-460Z-fast.json
    const replayFast2 = [
      "Running `npm run gate:quick` now and waiting for it to finish.",
      JSON.stringify(
        {
          status: "done",
          branch: "bug/304-settings-shop-url",
          commit: "6dd6b3f",
          summary: "Replaced the hardcoded preview URL with the real origin/locale storefront URL.",
          files_changed: ["src/features/settings/storefront-url.ts"],
          checks: ["npm run gate:quick (all PASS)"],
          blockers: [],
          follow_ups: [],
        },
        null,
        2,
      ),
    ].join("\n");

    // Trimmed from .claude/state/agy/2026-11-20T21-59-45-281Z-backend.json (status ERROR + EOF)
    const replayBackend3 = [
      "```json",
      JSON.stringify(
        {
          status: "done",
          summary:
            "Exported ensureStatic and generateStaticParams so unknown product pages return HTTP 404.",
          branch: "bug/303-product-404",
          commits: ["5c84af1 fix(storefront): return HTTP 404 (#303)"],
          files_changed: ["src/app/[locale]/p/[id]/page.tsx"],
          pr_url: "",
          checks_run: [{ command: "npm run gate:quick", result: "pass", notes: "all passed" }],
          blockers: [],
          follow_ups: ["Audit other dynamic routes."],
        },
        null,
        2,
      ),
      "```",
      JSON.stringify(
        {
          status: "done",
          summary:
            "Exported ensureStatic and generateStaticParams so unknown product pages return HTTP 404.",
          branch: "bug/303-product-404",
          commits: ["5c84af1 fix(storefront): return HTTP 404 (#303)"],
          files_changed: ["src/app/[locale]/p/[id]/page.tsx"],
          pr_url: "",
          checks_run: [{ command: "npm run gate:quick", result: "pass", notes: "all passed" }],
          blockers: [],
          follow_ups: ["Audit other dynamic routes."],
        },
        null,
        2,
      ),
    ].join("\n");

    expect(reportFromText(replayFast1)).toMatchObject({
      status: "done",
      summary: expect.stringContaining("Moved the storefront link preview"),
    });
    expect(reportFromText(replayFast2)).toMatchObject({
      status: "done",
      summary: expect.stringContaining("Replaced the hardcoded preview URL"),
    });
    expect(reportFromText(replayBackend3)).toEqual({
      status: "done",
      summary:
        "Exported ensureStatic and generateStaticParams so unknown product pages return HTTP 404.",
      pr_url: "",
      blockers: [],
      follow_ups: ["Audit other dynamic routes."],
    });
  });
});

describe("requiredStepsFor", () => {
  it("requires format:check, lint, typecheck and test by default", () => {
    expect(requiredStepsFor(["src/app/page.tsx"])).toEqual([
      "format:check",
      "lint",
      "typecheck",
      "test",
    ]);
  });

  it("adds test:tooling when scripts/ or .github/.scripts/ files changed", () => {
    expect(requiredStepsFor(["scripts/agy-delegate.mjs"])).toContain("test:tooling");
    expect(requiredStepsFor([".github/.scripts/check.js"])).toContain("test:tooling");
  });
});

describe("gitFacts", () => {
  let root: string;
  let repo: string;
  let nonRepo: string;
  const git = (args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "agy-gitfacts-"));
    repo = join(root, "repo");
    nonRepo = join(root, "not-a-repo");
    mkdirSync(repo);
    mkdirSync(nonRepo);
    git(["init", "-b", "base"]);
    git(["config", "user.name", "Test"]);
    git(["config", "user.email", "test@example.com"]);
    writeFileSync(join(repo, "README.md"), "init\n");
    git(["add", "README.md"]);
    git(["commit", "-m", "chore: init"]);
    git(["checkout", "-b", "feature/test"]);
    writeFileSync(join(repo, "file.txt"), "hello\n");
    git(["add", "file.txt"]);
    git(["commit", "-m", "feat: add file"]);
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("reads branch, head, commits, files and dirty state against base", () => {
    const facts = gitFacts(repo, "base");
    expect(facts).toEqual({
      head: git(["rev-parse", "HEAD"]),
      branch: "feature/test",
      commits: [expect.stringMatching(/^[0-9a-f]+ feat: add file$/)],
      files: ["file.txt"],
      dirty: [],
      note: "",
    });
  });

  it("reports dirty files", () => {
    writeFileSync(join(repo, "untracked.txt"), "wip\n");
    const facts = gitFacts(repo, "base");
    rmSync(join(repo, "untracked.txt"));
    expect(facts.dirty).toEqual(["?? untracked.txt"]);
  });

  it("returns empty arrays and a note when cwd is not a git repo or base is missing", () => {
    const outside = gitFacts(nonRepo, "base");
    expect(outside.commits).toEqual([]);
    expect(outside.files).toEqual([]);
    expect(outside.dirty).toEqual([]);
    expect(outside.note).not.toBe("");

    const missingBase = gitFacts(repo, "does-not-exist");
    expect(missingBase.commits).toEqual([]);
    expect(missingBase.files).toEqual([]);
    expect(missingBase.note).toMatch(/does-not-exist/);
  });

  it("fails closed when git status --porcelain fails", () => {
    const broken = join(root, "broken-status");
    mkdirSync(broken);
    const run = (args: string[]) => execFileSync("git", args, { cwd: broken, encoding: "utf8" });
    run(["init", "-b", "base"]);
    run(["config", "user.name", "Test"]);
    run(["config", "user.email", "test@example.com"]);
    writeFileSync(join(broken, "a.txt"), "a\n");
    run(["add", "a.txt"]);
    run(["commit", "-m", "chore: init"]);
    // Corrupt the git index so `git status --porcelain` fails while `rev-parse` still works.
    writeFileSync(join(broken, ".git", "index"), "not a valid git index");

    const facts = gitFacts(broken, "base");
    expect(facts.dirty).toEqual(["<git status failed>"]);
  });
});

describe("decide", () => {
  it("returns 0 with verify false on a matching receipt", () => {
    expect(
      decide({
        proc: successProc(),
        report: cleanReport,
        facts: cleanFacts,
        receipt: matchingReceipt,
        requiredSteps: requiredStepsFor(cleanFacts.files),
      }),
    ).toEqual({ code: 0, reason: "done", verify: false });
  });

  it("accepts test:coverage in place of test on the receipt", () => {
    expect(
      decide({
        proc: successProc(),
        report: cleanReport,
        facts: cleanFacts,
        receipt: {
          ...matchingReceipt,
          steps: ["format:check", "lint", "typecheck", "test:coverage"],
        },
        requiredSteps: requiredStepsFor(cleanFacts.files),
      }),
    ).toEqual({ code: 0, reason: "done", verify: false });
  });

  it("sets verify true when receipt is missing, for another head, or missing a required step", () => {
    expect(
      decide({
        proc: successProc(),
        report: cleanReport,
        facts: cleanFacts,
        receipt: null,
        requiredSteps: requiredStepsFor(cleanFacts.files),
      }).verify,
    ).toBe(true);

    expect(
      decide({
        proc: successProc(),
        report: cleanReport,
        facts: cleanFacts,
        receipt: { ...matchingReceipt, head: "0000000000000000000000000000000000000000" },
        requiredSteps: requiredStepsFor(cleanFacts.files),
      }).verify,
    ).toBe(true);

    expect(
      decide({
        proc: successProc(),
        report: cleanReport,
        facts: cleanFacts,
        receipt: { ...matchingReceipt, steps: ["format:check", "lint", "typecheck"] },
        requiredSteps: requiredStepsFor(cleanFacts.files),
      }).verify,
    ).toBe(true);
  });

  it("requires test:tooling when a tooling path changed", () => {
    const toolingFacts = { ...cleanFacts, files: ["scripts/agy-delegate.mjs"] };
    const steps = requiredStepsFor(toolingFacts.files);
    expect(
      decide({
        proc: successProc(),
        report: cleanReport,
        facts: toolingFacts,
        receipt: matchingReceipt,
        requiredSteps: steps,
      }).verify,
    ).toBe(true);

    expect(
      decide({
        proc: successProc(),
        report: cleanReport,
        facts: toolingFacts,
        receipt: { ...matchingReceipt, steps: [...matchingReceipt.steps, "test:tooling"] },
        requiredSteps: steps,
      }),
    ).toEqual({ code: 0, reason: "done", verify: false });
  });

  it("ignores the receipt when gate-defining files changed", () => {
    const gateFiles = [
      "scripts/gate.mjs",
      "scripts/ci-scope.mjs",
      "scripts/supabase-status.mjs",
      "package.json",
      "vitest.config.mts",
      "vitest.tooling.config.mts",
      "eslint.config.mjs",
      "tsconfig.json",
      "tsconfig.build.json",
      ".prettierrc",
      ".prettierrc.json",
      ".prettierignore",
      "playwright.config.ts",
      "playwright.supabase.config.ts",
    ];
    for (const file of gateFiles) {
      expect(gateDefiningFiles([file, "src/app/page.tsx"]), file).toEqual([file]);
      const files = [file];
      const decision = decide({
        proc: successProc(),
        report: cleanReport,
        facts: { ...cleanFacts, files },
        receipt: { ...matchingReceipt, steps: [...matchingReceipt.steps, "test:tooling"] },
        requiredSteps: requiredStepsFor(files),
      });
      expect(decision.verify, file).toBe(true);
    }
    expect(gateDefiningFiles(["src/app/page.tsx", "scripts/agy-delegate.mjs"])).toEqual([]);
  });

  it("returns 1 on blocked report, dirty files, or no commits", () => {
    expect(
      decide({
        proc: successProc(),
        report: { ...cleanReport, status: "blocked" },
        facts: cleanFacts,
        receipt: matchingReceipt,
        requiredSteps: requiredStepsFor(cleanFacts.files),
      }),
    ).toEqual({ code: 1, reason: "blocked", verify: false });

    expect(
      decide({
        proc: successProc(),
        report: cleanReport,
        facts: { ...cleanFacts, dirty: [" M src/a.ts"] },
        receipt: matchingReceipt,
        requiredSteps: requiredStepsFor(cleanFacts.files),
      }),
    ).toMatchObject({ code: 1, reason: "uncommitted changes", verify: false });

    expect(
      decide({
        proc: successProc(),
        report: cleanReport,
        facts: { ...cleanFacts, commits: [] },
        receipt: matchingReceipt,
        requiredSteps: requiredStepsFor(cleanFacts.files),
      }),
    ).toMatchObject({ code: 1, reason: "no commits", verify: false });
  });

  it("returns 1 with a resume hint when there is no report but commits exist", () => {
    expect(
      decide({
        proc: successProc(undefined),
        report: null,
        facts: cleanFacts,
        receipt: null,
        requiredSteps: requiredStepsFor(cleanFacts.files),
      }),
    ).toEqual({
      code: 1,
      reason: "no report; resume and ask for the JSON report",
      verify: false,
    });

    const eofProc = {
      status: 1,
      stdout: agyResult({ status: "ERROR", error: "API error: EOF", structured_output: undefined }),
      stderr: "",
    };
    expect(
      decide({
        proc: eofProc,
        report: null,
        facts: cleanFacts,
        receipt: null,
        requiredSteps: requiredStepsFor(cleanFacts.files),
      }),
    ).toEqual({
      code: 1,
      reason: "no report; resume and ask for the JSON report",
      verify: false,
    });
  });

  it("recovers a done report even when agy exited with ERROR (EOF)", () => {
    const eofProc = {
      status: 0,
      stdout: agyResult({
        status: "ERROR",
        error: 'API error (attempt 1): request failed: Post "https://x": EOF',
        structured_output: undefined,
      }),
      stderr: "",
    };

    const withoutReceipt = decide({
      proc: eofProc,
      report: cleanReport,
      facts: cleanFacts,
      receipt: null,
      requiredSteps: requiredStepsFor(cleanFacts.files),
    });
    expect(withoutReceipt.code).not.toBe(3);
    expect(withoutReceipt.verify).toBe(true);
    expect(withoutReceipt.reason).toContain("EOF");

    const withReceipt = decide({
      proc: eofProc,
      report: cleanReport,
      facts: cleanFacts,
      receipt: matchingReceipt,
      requiredSteps: requiredStepsFor(cleanFacts.files),
    });
    expect(withReceipt.code).toBe(0);
    expect(withReceipt.verify).toBe(false);
    expect(withReceipt.reason).toContain("EOF");
  });

  it("keeps print_timeout, unavailable (3), other agy errors (1), and missing JSON (3)", () => {
    const noCommits = { ...cleanFacts, commits: [], files: [] };
    const timeoutProc = {
      status: 1,
      stdout: JSON.stringify({
        conversation_id: "c-2",
        status: "ERROR",
        finished_reason: "print_timeout",
      }),
      stderr: 'AGY_ERROR: {"status":"DEADLINE_EXCEEDED","reason":"print_timeout"}',
    };
    expect(
      decide({
        proc: timeoutProc,
        report: null,
        facts: noCommits,
        receipt: null,
        requiredSteps: [],
      }),
    ).toMatchObject({ code: 1, verify: false, reason: expect.stringMatching(/^timed out/) });

    for (const [stderr, error] of [
      ['AGY_ERROR: {"status":"RESOURCE_EXHAUSTED","reason":"quota"}', ""],
      ["", "Please sign in to continue"],
      ["", 'API error (attempt 1): request failed: Post "https://x": EOF'],
    ]) {
      const stdout = JSON.stringify({ conversation_id: "", status: "ERROR", error });
      expect(
        decide({
          proc: { status: 1, stdout, stderr },
          report: null,
          facts: noCommits,
          receipt: null,
          requiredSteps: [],
        }).code,
      ).toBe(3);
    }

    expect(
      decide({
        proc: {
          status: 1,
          stdout: JSON.stringify({ status: "ERROR", error: "bad model" }),
          stderr: "",
        },
        report: null,
        facts: noCommits,
        receipt: null,
        requiredSteps: [],
      }),
    ).toEqual({ code: 1, reason: "bad model", verify: false });

    expect(
      decide({
        proc: { error: new Error("spawn agy ENOENT") },
        report: null,
        facts: noCommits,
        receipt: null,
        requiredSteps: [],
      }).code,
    ).toBe(3);

    expect(
      decide({
        proc: { status: 1, stdout: "{not json", stderr: "boom" },
        report: null,
        facts: noCommits,
        receipt: null,
        requiredSteps: [],
      }),
    ).toMatchObject({ code: 3, verify: false, reason: expect.stringContaining("boom") });
  });
});

describe("withGateLock", () => {
  let repo: string;
  let commonDir: string;

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "agy-lock-"));
    execFileSync("git", ["init", "-b", "main"], { cwd: repo });
    commonDir = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd: repo,
      encoding: "utf8",
    }).trim();
  });

  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it("defaults LOCK_STALE_MS to 60 minutes (above worst-case gate time)", () => {
    expect(LOCK_STALE_MS).toBe(60 * 60_000);
  });

  it("acquires the lock with a token and always releases it in finally", () => {
    const lockPath = join(repo, commonDir, "agy-gate.lock");
    expect(() =>
      withGateLock(repo, () => {
        expect(existsSync(lockPath)).toBe(true);
        expect(readFileSync(join(lockPath, "token"), "utf8")).toMatch(/^[0-9a-f]{32}$/);
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(existsSync(lockPath)).toBe(false);
  });

  it("leaves the lock in place when the token no longer matches", () => {
    const lockPath = join(repo, commonDir, "agy-gate.lock");
    withGateLock(repo, () => {
      writeFileSync(join(lockPath, "token"), "taken-over-by-another-process");
    });
    expect(existsSync(lockPath)).toBe(true);
    expect(readFileSync(join(lockPath, "token"), "utf8")).toBe("taken-over-by-another-process");
    rmSync(lockPath, { recursive: true, force: true });
  });

  it("takes over a stale lock older than staleMs", () => {
    const lockPath = join(repo, commonDir, "agy-gate.lock");
    mkdirSync(lockPath);
    writeFileSync(join(lockPath, "token"), "stale-token");
    const old = new Date(Date.now() - 60_000);
    utimesSync(lockPath, old, old);

    const value = withGateLock(repo, () => "ok", { retryMs: 10, staleMs: 1_000 });
    expect(value).toBe("ok");
    expect(existsSync(lockPath)).toBe(false);
  });
});

describe("formatSummary", () => {
  const opts = parseArgs(["frontend", "--brief", "b"]);
  const parsedResult = JSON.parse(agyResult());

  it("prints gitFacts, verified receipt, and drops checks", () => {
    const text = formatSummary(
      opts,
      {
        code: 0,
        reason: "done",
        result: parsedResult,
        report: cleanReport,
        facts: cleanFacts,
        verification: { kind: "receipt", head: cleanFacts.head },
        recoveredError: "",
      },
      null,
    );
    expect(text).toContain("agy foodbiz-frontend (gemini-4-neon-high): done [exit 0]");
    expect(text).toContain(
      "conversation: c-1 | 12s, 3 turns | tokens in 20000 (cache 15000) out 900",
    );
    expect(text).toContain("verified: receipt abc1234");
    expect(text).toContain("branch: feature/42-filter | pr: -");
    expect(text).toContain("  - abc1234 feat(orders): status filter");
    expect(text).toContain("  - src/features/orders/filter.tsx");
    expect(text).toContain("blockers: -");
    expect(text).not.toContain("checks:");
    expect(text).not.toContain("review:");
  });

  it("prints a review line when outcome.reviewFiles is non-empty", () => {
    const text = formatSummary(
      opts,
      {
        code: 0,
        reason: "done",
        result: parsedResult,
        report: cleanReport,
        facts: { ...cleanFacts, files: ["vitest.config.mts", "package.json"] },
        verification: { kind: "ran", cmd: "npm run -s gate:quick", seconds: 10 },
        recoveredError: "",
        reviewFiles: ["vitest.config.mts", "package.json"],
      },
      null,
    );
    expect(text).toContain("review: gate-defining files changed: vitest.config.mts, package.json");
  });

  it("formats ran, FAILED (with tail), skipped and recovered error note", () => {
    const ran = formatSummary(
      opts,
      {
        code: 0,
        reason: "done",
        result: parsedResult,
        report: cleanReport,
        facts: cleanFacts,
        verification: { kind: "ran", cmd: "npm run -s gate:quick", seconds: 42 },
        recoveredError: "API error: EOF",
      },
      null,
    );
    expect(ran).toContain("note: agy reported API error: EOF but the report was recovered");
    expect(ran).toContain("verified: ran npm run -s gate:quick 42s pass");

    const failed = formatSummary(
      opts,
      {
        code: 1,
        reason: "gate failed",
        result: parsedResult,
        report: cleanReport,
        facts: cleanFacts,
        verification: {
          kind: "failed",
          cmd: "npm run -s gate:quick",
          seconds: 5,
          tail: "TypeError: oops",
        },
        recoveredError: "",
      },
      null,
    );
    expect(failed).toContain("verified: FAILED npm run -s gate:quick");
    expect(failed).toContain("TypeError: oops");

    const skipped = formatSummary(
      opts,
      {
        code: 1,
        reason: "blocked",
        result: parsedResult,
        report: { ...cleanReport, status: "blocked" },
        facts: cleanFacts,
        verification: { kind: "skipped", reason: "blocked" },
        recoveredError: "",
      },
      null,
    );
    expect(skipped).toContain("verified: skipped (blocked)");
  });

  it("falls back to response text when report is missing", () => {
    const text = formatSummary(
      opts,
      {
        code: 1,
        reason: "no structured report in agy output",
        result: parsedResult,
        report: null,
        facts: { ...cleanFacts, commits: [], files: [] },
        verification: { kind: "skipped", reason: "no structured report in agy output" },
        recoveredError: "",
      },
      null,
    );
    expect(text).toContain("response (no report): ok");
  });
});

describe("main with a fake agy", () => {
  let dir: string;
  let repo: string;
  let gitDir: string;

  const git = (args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  const fakeAgy = (body: string) => {
    const bin = join(dir, `agy-${Math.random().toString(36).slice(2)}`);
    writeFileSync(bin, `#!/usr/bin/env node\n${body}\n`);
    chmodSync(bin, 0o755);
    return bin;
  };

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "agy-delegate-"));
    repo = join(dir, "repo");
    mkdirSync(repo);
    git(["init", "-b", "base"]);
    git(["config", "user.name", "Test"]);
    git(["config", "user.email", "test@example.com"]);
    writeFileSync(join(repo, "README.md"), "base\n");
    git(["add", "README.md"]);
    git(["commit", "-m", "chore: base"]);
    git(["checkout", "-b", "feature/42-filter"]);
    writeFileSync(join(repo, "filter.ts"), "export const x = 1;\n");
    git(["add", "filter.ts"]);
    git(["commit", "-m", "feat(orders): add filter"]);
    gitDir = git(["rev-parse", "--absolute-git-dir"]);
    writeFileSync(join(dir, "brief.md"), "BRIEF BODY");
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("prepends contract, verifies via AGY_GATE_CMD, saves raw result and returns 0", () => {
    rmSync(join(gitDir, "gate-receipt.json"), { force: true });
    const bin = fakeAgy(
      `const fs = require("fs");
       fs.writeFileSync(${JSON.stringify(join(dir, "seen.json"))}, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
       console.log(${JSON.stringify(agyResult())});`,
    );
    const state = join(dir, "state-pass");
    const lines: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg) => lines.push(String(msg)));
    const code = main(
      ["frontend", "--brief", join(dir, "brief.md"), "--cwd", repo, "--base", "base"],
      {
        AGY_BIN: bin,
        AGY_STATE_DIR: state,
        AGY_GATE_CMD: 'node -e "process.exit(0)"',
      },
    );
    log.mockRestore();

    expect(code).toBe(0);
    const summary = lines.join("\n");
    expect(summary).toContain("verified: ran");
    expect(summary).toContain("pass");
    expect(summary).toContain("branch: feature/42-filter");
    expect(summary).toContain("filter.ts");

    const seen = JSON.parse(readFileSync(join(dir, "seen.json"), "utf8"));
    expect(seen.cwd).toBe(repo);
    expect(seen.argv[1]).toMatch(/^# Delegation contract/);
    expect(seen.argv[1]).toMatch(/BRIEF BODY$/);
    const [raw] = readdirSync(state);
    expect(raw).toMatch(/-frontend\.json$/);
  });

  it("returns 1 and prints last 40 lines when AGY_GATE_CMD fails", () => {
    rmSync(join(gitDir, "gate-receipt.json"), { force: true });
    const bin = fakeAgy(`console.log(${JSON.stringify(agyResult())});`);
    const lines: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg) => lines.push(String(msg)));
    const code = main(
      ["frontend", "--brief", join(dir, "brief.md"), "--cwd", repo, "--base", "base"],
      {
        AGY_BIN: bin,
        AGY_STATE_DIR: join(dir, "state-fail"),
        AGY_GATE_CMD: "node -e \"console.error('gate boom'); process.exit(1)\"",
      },
    );
    log.mockRestore();

    expect(code).toBe(1);
    const summary = lines.join("\n");
    expect(summary).toContain("verified: FAILED");
    expect(summary).toContain("gate boom");
  });

  it("returns 0 via receipt without running the gate when receipt matches HEAD", () => {
    const head = git(["rev-parse", "HEAD"]);
    writeFileSync(
      join(gitDir, "gate-receipt.json"),
      JSON.stringify({
        head,
        steps: ["format:check", "lint", "typecheck", "test"],
        mode: "quick",
        at: new Date().toISOString(),
      }),
    );
    const bin = fakeAgy(`console.log(${JSON.stringify(agyResult())});`);
    const lines: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg) => lines.push(String(msg)));
    const code = main(
      ["frontend", "--brief", join(dir, "brief.md"), "--cwd", repo, "--base", "base"],
      {
        AGY_BIN: bin,
        AGY_STATE_DIR: join(dir, "state-receipt"),
        AGY_GATE_CMD: 'node -e "process.exit(1)"',
      },
    );
    log.mockRestore();
    rmSync(join(gitDir, "gate-receipt.json"), { force: true });

    expect(code).toBe(0);
    expect(lines.join("\n")).toContain(`verified: receipt ${head.slice(0, 7)}`);
  });

  it("recovers a done report from an ERROR (EOF) response and passes after gate verification", () => {
    rmSync(join(gitDir, "gate-receipt.json"), { force: true });
    const bin = fakeAgy(
      `console.log(${JSON.stringify(
        agyResult({
          status: "ERROR",
          error: 'API error (attempt 1): request failed: Post "https://x": EOF',
          structured_output: undefined,
          response: 'All done.\n{"status":"done","summary":"Recovered from EOF."}',
        }),
      )});`,
    );
    const lines: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg) => lines.push(String(msg)));
    const code = main(
      ["backend", "--brief", join(dir, "brief.md"), "--cwd", repo, "--base", "base"],
      {
        AGY_BIN: bin,
        AGY_STATE_DIR: join(dir, "state-eof"),
        AGY_GATE_CMD: 'node -e "process.exit(0)"',
      },
    );
    log.mockRestore();

    expect(code).toBe(0);
    const summary = lines.join("\n");
    expect(summary).toContain("note: agy reported");
    expect(summary).toContain("but the report was recovered");
    expect(summary).toContain("verified: ran");
  });

  it("returns 1 when the tree changes during verification", () => {
    rmSync(join(gitDir, "gate-receipt.json"), { force: true });
    const bin = fakeAgy(`console.log(${JSON.stringify(agyResult())});`);
    const lines: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg) => lines.push(String(msg)));
    const code = main(
      ["frontend", "--brief", join(dir, "brief.md"), "--cwd", repo, "--base", "base"],
      {
        AGY_BIN: bin,
        AGY_STATE_DIR: join(dir, "state-mutated"),
        AGY_GATE_CMD: "node -e \"require('fs').writeFileSync('created-by-gate.txt', 'x')\"",
      },
    );
    log.mockRestore();
    rmSync(join(repo, "created-by-gate.txt"), { force: true });

    expect(code).toBe(1);
    expect(lines.join("\n")).toContain("tree changed during verification");
  });

  it("ignores receipt, runs gate, keeps exit 0, and flags reviewFiles for gate-defining diffs", () => {
    const gateRepo = join(dir, "repo-gate-defining");
    mkdirSync(gateRepo);
    const run = (args: string[]) =>
      execFileSync("git", args, { cwd: gateRepo, encoding: "utf8" }).trim();
    run(["init", "-b", "base"]);
    run(["config", "user.name", "Test"]);
    run(["config", "user.email", "test@example.com"]);
    writeFileSync(join(gateRepo, "README.md"), "base\n");
    run(["add", "README.md"]);
    run(["commit", "-m", "chore: base"]);
    run(["checkout", "-b", "feature/vitest-cfg"]);
    writeFileSync(join(gateRepo, "vitest.config.mts"), "export default {};\n");
    run(["add", "vitest.config.mts"]);
    run(["commit", "-m", "chore: edit vitest config"]);

    const head = run(["rev-parse", "HEAD"]);
    const gDir = run(["rev-parse", "--absolute-git-dir"]);
    writeFileSync(
      join(gDir, "gate-receipt.json"),
      JSON.stringify({
        head,
        steps: ["format:check", "lint", "typecheck", "test"],
        mode: "quick",
        at: new Date().toISOString(),
      }),
    );

    const state = join(dir, "state-review-files");
    const bin = fakeAgy(`console.log(${JSON.stringify(agyResult())});`);
    const lines: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg) => lines.push(String(msg)));
    const code = main(
      ["frontend", "--brief", join(dir, "brief.md"), "--cwd", gateRepo, "--base", "base"],
      {
        AGY_BIN: bin,
        AGY_STATE_DIR: state,
        AGY_GATE_CMD: 'node -e "process.exit(0)"',
      },
    );
    log.mockRestore();

    expect(code).toBe(0);
    const summary = lines.join("\n");
    expect(summary).toContain("verified: ran");
    expect(summary).toContain("review: gate-defining files changed: vitest.config.mts");
    const [raw] = readdirSync(state);
    expect(JSON.parse(readFileSync(join(state, raw), "utf8")).reviewFiles).toEqual([
      "vitest.config.mts",
    ]);
  });

  it("sends a resumed brief as-is and returns 1 on blocked", () => {
    const bin = fakeAgy(
      `require("fs").writeFileSync(${JSON.stringify(join(dir, "resumed.txt"))}, process.argv[3]);
       console.log(${JSON.stringify(agyResult({ structured_output: { ...cleanReport, status: "blocked" } }))});`,
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = main(
      ["ops", "--brief", join(dir, "brief.md"), "--cwd", repo, "--base", "base", "--resume", "c-1"],
      {
        AGY_BIN: bin,
        AGY_STATE_DIR: join(dir, "state-resume"),
      },
    );
    log.mockRestore();
    expect(code).toBe(1);
    expect(readFileSync(join(dir, "resumed.txt"), "utf8")).toBe("BRIEF BODY");
  });

  it("returns 3 when agy is missing and 2 on usage errors", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      main(["fast", "--brief", join(dir, "brief.md"), "--cwd", repo], {
        AGY_BIN: join(dir, "missing-agy"),
        AGY_STATE_DIR: join(dir, "state-missing"),
      }),
    ).toBe(3);
    expect(main(["nope"], {})).toBe(2);
    expect(err).toHaveBeenCalledWith(expect.stringMatching(/unknown role/));
    log.mockRestore();
    err.mockRestore();
  });
});
