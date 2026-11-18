#!/usr/bin/env node
// Delegates one job to a Gemini agent through the Antigravity CLI (agy), headless,
// and prints only a compact report. Used by the opt-in gemini-orchestrator Claude
// agent (.claude/agents/gemini-orchestrator.md); nothing else depends on it.
//
//   node scripts/agy-delegate.mjs <role> --brief <file> [--cwd <worktree>]
//        [--tier <tier>] [--resume <conversation_id>] [--timeout 45m]
//
// Roles map to .agents/agents/foodbiz-<role>.md; ROLES below is the single place
// to change models. A new job gets scripts/agy-contract.md prepended to the brief;
// a resumed one (--resume) sends the brief as-is into the same conversation.
// The raw agy JSON is kept in .claude/state/agy/ (gitignored).
//
// Exit codes: 0 done, 1 ran but blocked/failed/timed out (resumable),
//             2 usage error, 3 agy unavailable (fall back to Claude subagents).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT = join(ROOT, "scripts/agy-contract.md");
const SCHEMA = join(ROOT, "scripts/agy-report.schema.json");

/** role -> agy agent and model per tier; the first tier is the default. */
export const ROLES = {
  frontend: {
    agent: "foodbiz-frontend",
    tiers: { high: "gemini-4-neon-high", xhigh: "gemini-4-neon-xhigh" },
  },
  backend: {
    agent: "foodbiz-backend",
    tiers: { high: "gemini-4-neon-high", xhigh: "gemini-4-neon-xhigh" },
  },
  fast: { agent: "foodbiz-fast", tiers: { high: "gemini-4-hydrogen-high" } },
  ops: {
    agent: "foodbiz-ops",
    tiers: { medium: "gemini-3.8-flash-medium", low: "gemini-3.8-flash-low" },
  },
};

const USAGE =
  "usage: node scripts/agy-delegate.mjs <frontend|backend|fast|ops> --brief <file> " +
  "[--cwd <dir>] [--tier <tier>] [--resume <conversation_id>] [--timeout 45m]";

// Errors that mean agy itself cannot serve the job right now.
const UNAVAILABLE =
  /RESOURCE_EXHAUSTED|UNAVAILABLE|UNAUTHENTICATED|PERMISSION_DENIED|quota|rate.?limit|sign.?in|authenticat|credential|\b429\b|\b50[23]\b|API error|EOF/i;

export class UsageError extends Error {}

/** Parses argv (without node and script) into options; throws UsageError. */
export function parseArgs(argv) {
  const [role, ...rest] = argv;
  if (!role || !ROLES[role]) throw new UsageError(`unknown role '${role ?? ""}'.\n${USAGE}`);
  const opts = { role, cwd: process.cwd(), timeout: "45m" };
  const flags = {
    "--brief": "brief",
    "--cwd": "cwd",
    "--tier": "tier",
    "--resume": "resume",
    "--timeout": "timeout",
  };
  for (let i = 0; i < rest.length; i += 2) {
    const key = flags[rest[i]];
    if (!key || rest[i + 1] === undefined)
      throw new UsageError(`bad argument '${rest[i]}'.\n${USAGE}`);
    opts[key] = rest[i + 1];
  }
  if (!opts.brief) throw new UsageError(`--brief is required.\n${USAGE}`);
  const tiers = ROLES[role].tiers;
  opts.tier ??= Object.keys(tiers)[0];
  if (!tiers[opts.tier])
    throw new UsageError(
      `role '${role}' has no tier '${opts.tier}' (${Object.keys(tiers).join(", ")}).`,
    );
  if (!/^\d+[hms]$/.test(opts.timeout))
    throw new UsageError(`--timeout must look like 45m, 90s or 1h.`);
  opts.cwd = resolve(opts.cwd);
  return opts;
}

/** Converts 45m / 90s / 1h to milliseconds. */
export const durationMs = (text) =>
  Number(text.slice(0, -1)) * { h: 3_600_000, m: 60_000, s: 1000 }[text.at(-1)];

/** The agy argv for one job. */
export function buildAgyArgs(opts, prompt) {
  const { agent, tiers } = ROLES[opts.role];
  return [
    "-p",
    prompt,
    "--agent",
    agent,
    "--model",
    tiers[opts.tier],
    "--output-format",
    "json",
    "--json-schema",
    SCHEMA,
    "--dangerously-skip-permissions",
    "--print-timeout",
    opts.timeout,
    ...(opts.resume ? ["--conversation", opts.resume] : []),
  ];
}

/** Last JSON object printed on stdout, or null. */
function parseJsonOutput(stdout) {
  const lines = (stdout ?? "").trim().split("\n").toReversed();
  for (const line of lines) {
    if (!line.startsWith("{")) continue;
    try {
      return JSON.parse(line);
    } catch {
      // keep looking
    }
  }
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

/** The AGY_ERROR {status, reason, retryable} line agy prints on stderr, if any. */
function parseAgyError(stderr) {
  const match = /^AGY_ERROR: (.*)$/m.exec(stderr ?? "");
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/**
 * agy drops `structured_output` when the model's JSON misses the schema; recover
 * the last JSON object in the response text and coerce it to the report shape
 * (anything but "done" counts as blocked).
 */
export function reportFromText(text) {
  const candidates = [...(text ?? "").matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)].map(
    (m) => m[1],
  );
  candidates.push((text ?? "").trim());
  for (const candidate of candidates.toReversed()) {
    let raw;
    try {
      raw = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (!raw || typeof raw !== "object" || !("status" in raw)) continue;
    const strings = (value) =>
      Array.isArray(value) ? value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))) : [];
    return {
      status: raw.status === "done" ? "done" : "blocked",
      summary: String(raw.summary ?? ""),
      branch: String(raw.branch ?? ""),
      commits: strings(raw.commits),
      files_changed: strings(raw.files_changed),
      pr_url: String(raw.pr_url ?? ""),
      checks_run: (Array.isArray(raw.checks_run) ? raw.checks_run : []).map((c) => ({
        command: String(c?.command ?? ""),
        result: ["pass", "fail", "skipped"].includes(c?.result) ? c.result : "fail",
        notes: String(c?.notes ?? c?.status ?? ""),
      })),
      blockers: strings(raw.blockers),
      follow_ups: strings(raw.follow_ups),
    };
  }
  return null;
}

/**
 * Classifies one finished agy process.
 * @returns {{ code: 0 | 1 | 3, reason: string, result: object | null, report: object | null }}
 */
export function classify({ error, status, stdout, stderr }) {
  if (error)
    return { code: 3, reason: `agy could not start: ${error.message}`, result: null, report: null };
  const result = parseJsonOutput(stdout);
  if (!result) {
    const tail = `${stderr ?? ""}${stdout ?? ""}`.trim().split("\n").slice(-3).join(" | ");
    return {
      code: 3,
      reason: `agy printed no JSON result (exit ${status}): ${tail}`,
      result: null,
      report: null,
    };
  }
  if (result.status !== "SUCCESS") {
    const agyError = parseAgyError(stderr);
    const detail = [agyError?.status, agyError?.reason, result.error].filter(Boolean).join(": ");
    if (result.finished_reason === "print_timeout" || agyError?.reason === "print_timeout")
      return { code: 1, reason: `timed out; resume to continue (${detail})`, result, report: null };
    return {
      code: UNAVAILABLE.test(detail) ? 3 : 1,
      reason: detail || "agy failed",
      result,
      report: null,
    };
  }
  const report = result.structured_output ?? reportFromText(result.response);
  if (!report)
    return { code: 1, reason: "no structured report in agy output", result, report: null };
  return report.status === "done"
    ? { code: 0, reason: "done", result, report }
    : { code: 1, reason: "blocked", result, report };
}

const list = (items) => (items?.length ? items.map((i) => `\n  - ${i}`).join("") : " -");

/** Compact text the orchestrator reads instead of the raw transcript. */
export function formatSummary(opts, outcome, rawPath) {
  const { result, report } = outcome;
  const model = ROLES[opts.role].tiers[opts.tier];
  const usage = result?.usage ?? {};
  const lines = [
    `agy ${ROLES[opts.role].agent} (${model}): ${outcome.reason} [exit ${outcome.code}]`,
  ];
  if (result) {
    lines.push(
      `conversation: ${result.conversation_id || "-"} | ${Math.round(result.duration_seconds ?? 0)}s, ` +
        `${result.num_turns ?? "?"} turns | tokens in ${usage.input_tokens ?? "?"} ` +
        `(cache ${usage.cache_read_tokens ?? 0}) out ${usage.output_tokens ?? "?"}`,
    );
  }
  if (report) {
    const checks = report.checks_run?.map(
      (c) => `${c.command}: ${c.result}${c.notes ? ` (${c.notes})` : ""}`,
    );
    lines.push(
      `summary: ${report.summary}`,
      `branch: ${report.branch || "-"} | pr: ${report.pr_url || "-"}`,
      `commits:${list(report.commits)}`,
      `files:${list(report.files_changed)}`,
      `checks:${list(checks)}`,
      `blockers:${list(report.blockers)}`,
      `follow_ups:${list(report.follow_ups)}`,
    );
  } else if (result?.response) {
    lines.push(`response (no report): ${result.response.slice(0, 1500)}`);
  }
  if (rawPath) lines.push(`raw: ${relative(ROOT, rawPath)}`);
  return lines.join("\n");
}

export function main(argv = process.argv.slice(2), env = process.env) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    return 2;
  }
  const brief = readFileSync(resolve(opts.brief), "utf8");
  const prompt = opts.resume ? brief : `${readFileSync(CONTRACT, "utf8")}${brief}`;
  const proc = spawnSync(env.AGY_BIN || "agy", buildAgyArgs(opts, prompt), {
    cwd: opts.cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: durationMs(opts.timeout) + 120_000,
  });
  const outcome = classify(proc);

  const dir = env.AGY_STATE_DIR || join(ROOT, ".claude/state/agy");
  mkdirSync(dir, { recursive: true });
  const rawPath = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${opts.role}.json`);
  writeFileSync(
    rawPath,
    JSON.stringify(
      { opts, exit: proc.status, result: outcome.result, stderr: proc.stderr?.slice(-4000) },
      null,
      2,
    ),
  );
  console.log(formatSummary(opts, outcome, rawPath));
  return outcome.code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main();
