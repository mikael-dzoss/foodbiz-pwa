// @vitest-environment node
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ROLES,
  UsageError,
  buildAgyArgs,
  classify,
  durationMs,
  formatSummary,
  main,
  parseArgs,
  reportFromText,
} from "./agy-delegate.mjs";

const report = {
  status: "done",
  summary: "Added the order filter.",
  branch: "feature/42-filter",
  commits: ["abc1234 feat(orders): status filter"],
  files_changed: ["src/features/orders/filter.tsx"],
  pr_url: "",
  checks_run: [{ command: "npm run gate:quick", result: "pass", notes: "" }],
  blockers: [],
  follow_ups: [],
};
const success = (structured: unknown) =>
  JSON.stringify({
    conversation_id: "c-1",
    status: "SUCCESS",
    response: "ok",
    duration_seconds: 12.4,
    num_turns: 3,
    structured_output: structured,
    usage: { input_tokens: 20000, output_tokens: 900, cache_read_tokens: 15000 },
  });

describe("parseArgs", () => {
  it("defaults the tier to the role's first one and resolves cwd", () => {
    const opts = parseArgs(["frontend", "--brief", "b.md", "--cwd", "/tmp/w"]);
    expect(opts).toMatchObject({
      role: "frontend",
      brief: "b.md",
      cwd: "/tmp/w",
      tier: "high",
      timeout: "45m",
    });
    expect(parseArgs(["ops", "--brief", "b.md"]).tier).toBe("medium");
  });

  it("accepts escalation tiers and resume", () => {
    const opts = parseArgs([
      "backend",
      "--brief",
      "b.md",
      "--tier",
      "xhigh",
      "--resume",
      "c-1",
      "--timeout",
      "90s",
    ]);
    expect(opts).toMatchObject({ tier: "xhigh", resume: "c-1", timeout: "90s" });
  });

  it.each([
    [[], /unknown role/],
    [["design", "--brief", "b"], /unknown role/],
    [["frontend"], /--brief is required/],
    [["frontend", "--brief"], /bad argument/],
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

describe("classify", () => {
  it("is done when the report says done", () => {
    const outcome = classify({ status: 0, stdout: success(report), stderr: "" });
    expect(outcome).toMatchObject({ code: 0, reason: "done", report });
  });

  it("is 1 when the report is blocked or missing", () => {
    expect(
      classify({ status: 0, stdout: success({ ...report, status: "blocked" }), stderr: "" }).code,
    ).toBe(1);
    expect(classify({ status: 0, stdout: success(undefined), stderr: "" })).toMatchObject({
      code: 1,
      reason: "no structured report in agy output",
    });
  });

  it("reads the JSON line after other stdout noise", () => {
    expect(
      classify({ status: 0, stdout: `[agy] note\n${success(report)}\n`, stderr: "" }).code,
    ).toBe(0);
  });

  it("treats a print timeout as resumable", () => {
    const stdout = JSON.stringify({
      conversation_id: "c-2",
      status: "ERROR",
      finished_reason: "print_timeout",
    });
    const stderr = 'AGY_ERROR: {"status":"DEADLINE_EXCEEDED","reason":"print_timeout"}';
    expect(classify({ status: 1, stdout, stderr })).toMatchObject({
      code: 1,
      reason: expect.stringMatching(/^timed out/),
    });
  });

  it.each([
    ["quota", 'AGY_ERROR: {"status":"RESOURCE_EXHAUSTED","reason":"quota"}', ""],
    ["auth", "", "Please sign in to continue"],
    ["transient API", "", 'API error (attempt 1): request failed: Post "https://x": EOF'],
  ])("is unavailable (3) on %s errors", (_label, stderr, error) => {
    const stdout = JSON.stringify({ conversation_id: "", status: "ERROR", error });
    expect(classify({ status: 1, stdout, stderr }).code).toBe(3);
  });

  it("is 1 on other agy errors", () => {
    const stdout = JSON.stringify({ status: "ERROR", error: "invalid model selection" });
    expect(classify({ status: 1, stdout, stderr: "" })).toMatchObject({
      code: 1,
      reason: "invalid model selection",
    });
    expect(
      classify({ status: 1, stdout: JSON.stringify({ status: "ERROR" }), stderr: "" }).reason,
    ).toBe("agy failed");
  });

  it("is unavailable when agy cannot start or prints no JSON", () => {
    expect(classify({ error: new Error("spawn agy ENOENT") }).code).toBe(3);
    expect(classify({ status: 1, stdout: "{not json", stderr: "boom" })).toMatchObject({
      code: 3,
      reason: expect.stringContaining("boom"),
    });
    expect(classify({ status: 0, stdout: "", stderr: undefined }).code).toBe(3);
  });
});

describe("formatSummary", () => {
  const opts = parseArgs(["frontend", "--brief", "b"]);

  it("lists the report compactly", () => {
    const text = formatSummary(
      opts,
      classify({ status: 0, stdout: success(report), stderr: "" }),
      null,
    );
    expect(text).toContain("agy foodbiz-frontend (gemini-4-neon-high): done [exit 0]");
    expect(text).toContain(
      "conversation: c-1 | 12s, 3 turns | tokens in 20000 (cache 15000) out 900",
    );
    expect(text).toContain("  - src/features/orders/filter.tsx");
    expect(text).toContain("  - npm run gate:quick: pass");
    expect(text).toContain("blockers: -");
  });

  it("falls back to the response text, then to the reason alone", () => {
    const noReport = classify({ status: 0, stdout: success(undefined), stderr: "" });
    expect(formatSummary(opts, noReport, null)).toContain("response (no report): ok");
    const failed = classify({ error: new Error("ENOENT") });
    expect(formatSummary(opts, failed, null).split("\n")).toHaveLength(1);
  });
});

describe("main with a fake agy", () => {
  let dir: string;
  const fakeAgy = (body: string) => {
    const bin = join(dir, `agy-${Math.random().toString(36).slice(2)}`);
    writeFileSync(bin, `#!/usr/bin/env node\n${body}\n`);
    chmodSync(bin, 0o755);
    return bin;
  };

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "agy-delegate-"));
    writeFileSync(join(dir, "brief.md"), "BRIEF BODY");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("prepends the contract, runs in cwd, saves the raw result and returns 0", () => {
    const bin = fakeAgy(
      `const fs = require("fs");
       fs.writeFileSync(${JSON.stringify(join(dir, "seen.json"))}, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
       console.log(${JSON.stringify(success(report))});`,
    );
    const state = join(dir, "state");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = main(["frontend", "--brief", join(dir, "brief.md"), "--cwd", dir], {
      AGY_BIN: bin,
      AGY_STATE_DIR: state,
    });
    log.mockRestore();

    expect(code).toBe(0);
    const seen = JSON.parse(readFileSync(join(dir, "seen.json"), "utf8"));
    expect(seen.cwd).toBe(dir);
    expect(seen.argv[1]).toMatch(/^# Delegation contract/);
    expect(seen.argv[1]).toMatch(/BRIEF BODY$/);
    const [raw] = readdirSync(state);
    expect(raw).toMatch(/-frontend\.json$/);
    expect(JSON.parse(readFileSync(join(state, raw), "utf8")).result.structured_output).toEqual(
      report,
    );
  });

  it("sends a resumed brief as-is", () => {
    const bin = fakeAgy(
      `require("fs").writeFileSync(${JSON.stringify(join(dir, "resumed.txt"))}, process.argv[3]);
       console.log(${JSON.stringify(success({ ...report, status: "blocked" }))});`,
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = main(["ops", "--brief", join(dir, "brief.md"), "--cwd", dir, "--resume", "c-1"], {
      AGY_BIN: bin,
      AGY_STATE_DIR: join(dir, "state2"),
    });
    log.mockRestore();
    expect(code).toBe(1);
    expect(readFileSync(join(dir, "resumed.txt"), "utf8")).toBe("BRIEF BODY");
  });

  it("returns 3 when agy is missing and 2 on usage errors", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      main(["fast", "--brief", join(dir, "brief.md"), "--cwd", dir], {
        AGY_BIN: join(dir, "missing-agy"),
        AGY_STATE_DIR: join(dir, "state3"),
      }),
    ).toBe(3);
    expect(main(["nope"], {})).toBe(2);
    expect(err).toHaveBeenCalledWith(expect.stringMatching(/unknown role/));
    log.mockRestore();
    err.mockRestore();
  });
});

describe("reportFromText", () => {
  it("recovers the last fenced JSON block and coerces it to the report shape", () => {
    const text = [
      "Here is my report:",
      "```json",
      '{"status":"blocked","checks_run":[{"command":"npm run gate:quick","status":"denied"}],"pr_url":null}',
      "```",
      "```json",
      '{"status":"denied","blockers":["hook denied"],"commits":[{"sha":"abc"}]}',
      "```",
    ].join("\n");
    expect(reportFromText(text)).toEqual({
      status: "blocked",
      summary: "",
      branch: "",
      commits: ['{"sha":"abc"}'],
      files_changed: [],
      pr_url: "",
      checks_run: [],
      blockers: ["hook denied"],
      follow_ups: [],
    });
  });

  it("reads a bare JSON response and maps unknown check results to fail", () => {
    const report = reportFromText(
      '{"status":"done","summary":"s","checks_run":[{"command":"c","result":"ok"},{"command":"d","result":"pass","notes":"n"}]}',
    );
    expect(report?.status).toBe("done");
    expect(report?.checks_run).toEqual([
      { command: "c", result: "fail", notes: "" },
      { command: "d", result: "pass", notes: "n" },
    ]);
  });

  it("returns null without a JSON object that has a status", () => {
    expect(reportFromText("no json here")).toBeNull();
    expect(reportFromText('```json\n{"summary":"x"}\n```')).toBeNull();
    expect(reportFromText(undefined)).toBeNull();
  });

  it("feeds classify when structured_output is missing", () => {
    const stdout = JSON.stringify({
      status: "SUCCESS",
      response: '```json\n{"status":"done"}\n```',
    });
    expect(classify({ status: 0, stdout, stderr: "" })).toMatchObject({ code: 0, reason: "done" });
  });
});
