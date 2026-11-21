#!/usr/bin/env node
// Delegates one job to a Gemini agent through the Antigravity CLI (agy), headless,
// and prints only a compact report. Used by the opt-in gemini-orchestrator Claude
// agent (.claude/agents/gemini-orchestrator.md); nothing else depends on it.
//
//   node scripts/agy-delegate.mjs <role> --brief <file> [--cwd <worktree>]
//        [--base <ref>] [--tier <tier>] [--resume <conversation_id>] [--timeout 45m]
//
// Roles map to .agents/agents/foodbiz-<role>.md; ROLES below is the single place
// to change models. A new job gets scripts/agy-contract.md prepended to the brief;
// a resumed one (--resume) sends the brief as-is into the same conversation.
// The raw agy JSON is kept in .claude/state/agy/ (gitignored).
//
// Exit codes: 0 done (gate verified on HEAD), 1 ran but blocked/failed/timed out
//             (resumable), 2 usage error, 3 agy unavailable (fall back to Claude).
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT = join(ROOT, "scripts/agy-contract.md");
const SCHEMA = join(ROOT, "scripts/agy-report.schema.json");
const GATE_TIMEOUT_MS = 15 * 60_000;
const LOCK_RETRY_MS = 5_000;
export const LOCK_STALE_MS = 60 * 60_000;

const GATE_DEFINING = [
  /^scripts\/gate\.mjs$/,
  /^scripts\/ci-scope\.mjs$/,
  /^scripts\/supabase-status\.mjs$/,
  /^package\.json$/,
  /^vitest[^/]*\.config\.[^/]+$/,
  /^eslint\.config\.[^/]+$/,
  /^tsconfig[^/]*\.json$/,
  /^\.prettierrc[^/]*$/,
  /^\.prettierignore$/,
  /^playwright[^/]*\.config\.[^/]+$/,
];

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
  "[--cwd <dir>] [--base <ref>] [--tier <tier>] [--resume <conversation_id>] [--timeout 45m]";

// Errors that mean agy itself cannot serve the job right now.
const UNAVAILABLE =
  /RESOURCE_EXHAUSTED|UNAVAILABLE|UNAUTHENTICATED|PERMISSION_DENIED|quota|rate.?limit|sign.?in|authenticat|credential|\b429\b|\b50[23]\b|API error|EOF/i;

export class UsageError extends Error {}

/**
 * @typedef {{ role: string, brief: string, cwd: string, base: string, tier: string, timeout: string, resume?: string }} Options
 * @typedef {{ status: "done" | "blocked", summary: string, blockers: string[], follow_ups: string[], pr_url: string }} Report
 * @typedef {{ head: string, branch: string, commits: string[], files: string[], dirty: string[], note: string }} GitFacts
 * @typedef {{ head: string, steps: string[], mode: string, at: string }} GateReceipt
 * @typedef {{ kind: "receipt", head: string }
 *   | { kind: "ran", cmd: string, seconds: number }
 *   | { kind: "failed", cmd: string, seconds: number, tail: string }
 *   | { kind: "skipped", reason: string }} Verification
 */

/**
 * Parses argv (without node and script) into options; throws UsageError.
 * @param {string[]} argv
 * @returns {Options}
 */
export function parseArgs(argv) {
  const [role, ...rest] = argv;
  if (!role || !ROLES[role]) throw new UsageError(`unknown role '${role ?? ""}'.\n${USAGE}`);
  /** @type {Record<string, string>} */
  const opts = { role, cwd: process.cwd(), base: "origin/develop", timeout: "45m" };
  /** @type {Record<string, string>} */
  const flags = {
    "--brief": "brief",
    "--cwd": "cwd",
    "--base": "base",
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
  if (opts.base.startsWith("-") || !/^[\w./-]+$/.test(opts.base))
    throw new UsageError(`--base '${opts.base}' must be a valid git ref.`);
  opts.cwd = resolve(opts.cwd);
  return /** @type {Options} */ (opts);
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

function errorDetailOf(result, stderr) {
  const agyError = parseAgyError(stderr);
  return (
    [agyError?.status, agyError?.reason, result?.error].filter(Boolean).join(": ") || "agy failed"
  );
}

/**
 * Coerces a raw report object (from structured_output or response text) to the
 * canonical report shape, dropping legacy keys (commit, commits, checks_run,
 * files_changed, branch). Anything other than "done" counts as "blocked".
 * @param {unknown} raw
 * @returns {Report | null}
 */
export function coerceReport(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !("status" in raw)) return null;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const strings = (value) =>
    Array.isArray(value) ? value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))) : [];
  return {
    status: obj.status === "done" ? "done" : "blocked",
    summary: String(obj.summary ?? ""),
    blockers: strings(obj.blockers),
    follow_ups: strings(obj.follow_ups),
    pr_url: String(obj.pr_url ?? ""),
  };
}

function tryParseReport(candidate) {
  try {
    return coerceReport(JSON.parse(candidate));
  } catch {
    return null;
  }
}

/** Returns the exclusive end index of the balanced JSON object starting at `start`, or -1. */
function balancedObjectEnd(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Recovers the last JSON report object in response text: checks fenced blocks,
 * then the whole text, then scans backwards over `{` positions for the last
 * balanced JSON object with a `status` property (preferring an enclosing outer
 * object over an inner nested object).
 * @param {string | undefined | null} text
 * @returns {Report | null}
 */
export function reportFromText(text) {
  const source = text ?? "";
  const fenced = [...source.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  for (const candidate of fenced.toReversed()) {
    const report = tryParseReport(candidate);
    if (report) return report;
  }

  const whole = tryParseReport(source.trim());
  if (whole) return whole;

  /** @type {{ report: Report, end: number } | null} */
  let best = null;
  for (let i = source.lastIndexOf("{"); i !== -1; i = i > 0 ? source.lastIndexOf("{", i - 1) : -1) {
    const end = balancedObjectEnd(source, i);
    if (end === -1) continue;
    if (best && end <= best.end) continue;
    const report = tryParseReport(source.slice(i, end));
    if (report) {
      best = { report, end };
      // If no closing brace exists after `end`, no earlier `{` can enclose `best`.
      if (source.indexOf("}", end) === -1) break;
    }
  }
  return best?.report ?? null;
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    return { ok: false, out: "", err: result.error?.message || (result.stderr ?? "").trim() };
  }
  return { ok: true, out: result.stdout ?? "", err: "" };
}

/**
 * Reads branch, HEAD, commits, changed files and dirty status from git.
 * Never throws; returns empty arrays and a note when cwd isn't a git repo or
 * base is missing.
 * @param {string} cwd
 * @param {string} base
 * @returns {GitFacts}
 */
export function gitFacts(cwd, base) {
  const inside = runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok || inside.out.trim() !== "true") {
    return {
      head: "",
      branch: "",
      commits: [],
      files: [],
      dirty: [],
      note: "not a git repository",
    };
  }
  const head = runGit(cwd, ["rev-parse", "HEAD"]).out.trim();
  const branch = runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
  const dirtyRes = runGit(cwd, ["status", "--porcelain"]);
  const dirty = dirtyRes.ok ? dirtyRes.out.split("\n").filter(Boolean) : ["<git status failed>"];

  const baseCheck = runGit(cwd, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
  if (!baseCheck.ok) {
    return {
      head,
      branch,
      commits: [],
      files: [],
      dirty,
      note: `base ref '${base}' not found`,
    };
  }

  const commitsRes = runGit(cwd, ["log", "--oneline", `${base}..HEAD`]);
  const filesRes = runGit(cwd, ["diff", "--name-only", `${base}...HEAD`]);
  const commits = commitsRes.ok ? commitsRes.out.trim().split("\n").filter(Boolean) : [];
  const files = filesRes.ok ? filesRes.out.trim().split("\n").filter(Boolean) : [];
  return { head, branch, commits, files, dirty, note: "" };
}

/**
 * Required gate steps for the changed files: format:check, lint, typecheck,
 * one of test / test:coverage, plus test:tooling for scripts/ or .github/.scripts/.
 * @param {string[]} files
 * @returns {string[]}
 */
export function requiredStepsFor(files) {
  const steps = ["format:check", "lint", "typecheck", "test"];
  const tooling = (files ?? []).some(
    (f) => f.startsWith("scripts/") || f.startsWith(".github/.scripts/"),
  );
  if (tooling) steps.push("test:tooling");
  return steps;
}

/**
 * Returns the subset of changed files that define or configure the gate/checks.
 * @param {string[]} files
 * @returns {string[]}
 */
export const gateDefiningFiles = (files) =>
  (files ?? []).filter((f) => GATE_DEFINING.some((pattern) => pattern.test(f)));

// The receipt and the gate guard catch sloppy self-reports, not a malicious
// agent, so Claude review of gate-defining changes and CI remain the real gates.
function receiptMatches(receipt, facts, requiredSteps) {
  if (!receipt || typeof receipt !== "object") return false;
  if (!facts?.head || receipt.head !== facts.head) return false;
  if (gateDefiningFiles(facts.files).length > 0) return false;
  const done = new Set(Array.isArray(receipt.steps) ? receipt.steps : []);
  return requiredSteps.every((step) =>
    step === "test" ? done.has("test") || done.has("test:coverage") : done.has(step),
  );
}

/**
 * Pure decision function for one completed agy process. Never returns exit 0
 * unless a trusted receipt already proves every required step passed on HEAD;
 * otherwise sets `verify: true` so `main` runs the gate before returning 0.
 * @param {{
 *   proc: { error?: Error, status?: number | null, stdout?: string, stderr?: string },
 *   report?: Report | null,
 *   facts?: GitFacts | null,
 *   receipt?: GateReceipt | null,
 *   requiredSteps?: string[],
 * }} input
 * @returns {{ code: 0 | 1 | 3, reason: string, verify: boolean }}
 */
export function decide({ proc, report, facts, receipt, requiredSteps }) {
  if (proc?.error) {
    return { code: 3, reason: `agy could not start: ${proc.error.message}`, verify: false };
  }
  const result = parseJsonOutput(proc?.stdout);
  if (!result) {
    const tail = `${proc?.stderr ?? ""}${proc?.stdout ?? ""}`
      .trim()
      .split("\n")
      .slice(-3)
      .join(" | ");
    return {
      code: 3,
      reason: `agy printed no JSON result (exit ${proc?.status}): ${tail}`,
      verify: false,
    };
  }

  const isAgyError = result.status !== "SUCCESS";
  const agyError = isAgyError ? parseAgyError(proc?.stderr) : null;
  const detail = isAgyError ? errorDetailOf(result, proc?.stderr) : "";
  const effectiveReport =
    report !== undefined
      ? report
      : (coerceReport(result.structured_output) ?? reportFromText(result.response));

  if (!effectiveReport) {
    if (
      isAgyError &&
      (result.finished_reason === "print_timeout" || agyError?.reason === "print_timeout")
    ) {
      return { code: 1, reason: `timed out; resume to continue (${detail})`, verify: false };
    }
    if ((facts?.commits?.length ?? 0) > 0) {
      return {
        code: 1,
        reason: "no report; resume and ask for the JSON report",
        verify: false,
      };
    }
    if (isAgyError) {
      return { code: UNAVAILABLE.test(detail) ? 3 : 1, reason: detail, verify: false };
    }
    return { code: 1, reason: "no structured report in agy output", verify: false };
  }

  const note = isAgyError ? ` (agy error: ${detail})` : "";
  if (effectiveReport.status !== "done") {
    return { code: 1, reason: `blocked${note}`, verify: false };
  }
  if ((facts?.dirty?.length ?? 0) > 0) {
    return { code: 1, reason: `uncommitted changes${note}`, verify: false };
  }
  if ((facts?.commits?.length ?? 0) === 0) {
    return { code: 1, reason: `no commits${note}`, verify: false };
  }

  const needed = requiredSteps ?? requiredStepsFor(facts?.files ?? []);
  if (receiptMatches(receipt, facts, needed)) {
    return { code: 0, reason: `done${note}`, verify: false };
  }
  return { code: 1, reason: `needs verification${note}`, verify: true };
}

function readReceipt(cwd) {
  const dirRes = runGit(cwd, ["rev-parse", "--absolute-git-dir"]);
  if (!dirRes.ok || !dirRes.out.trim()) return null;
  try {
    return JSON.parse(readFileSync(join(dirRes.out.trim(), "gate-receipt.json"), "utf8"));
  } catch {
    return null;
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Serialises gate runs across parallel wrapper processes with an atomic mkdir
 * lock at `<git-common-dir>/agy-gate.lock`. Retries every `retryMs` (default 5s),
 * takes over a lock older than `staleMs` (default 60 min), writes an owner token
 * on acquire, and releases in `finally` only if the token still matches.
 * @template T
 * @param {string} cwd
 * @param {() => T} fn
 * @param {{ retryMs?: number, staleMs?: number }} [options]
 * @returns {T}
 */
export function withGateLock(cwd, fn, { retryMs = LOCK_RETRY_MS, staleMs = LOCK_STALE_MS } = {}) {
  const commonRes = runGit(cwd, ["rev-parse", "--git-common-dir"]);
  const lockDir =
    commonRes.ok && commonRes.out.trim()
      ? join(resolve(cwd, commonRes.out.trim()), "agy-gate.lock")
      : join(cwd, ".agy-gate.lock");
  const tokenPath = join(lockDir, "token");
  const token = randomBytes(16).toString("hex");
  const isStale = () => Date.now() - statSync(lockDir).mtimeMs > staleMs;

  let acquired = false;
  while (!acquired) {
    try {
      mkdirSync(lockDir);
      writeFileSync(tokenPath, token);
      acquired = true;
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error)?.code !== "EEXIST") throw error;
      try {
        if (isStale()) {
          // Re-check mtime right before removing to narrow the takeover window.
          if (isStale()) rmSync(lockDir, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      sleepSync(retryMs);
    }
  }
  try {
    return fn();
  } finally {
    try {
      if (readFileSync(tokenPath, "utf8") === token) {
        rmSync(lockDir, { recursive: true, force: true });
      }
    } catch {
      // Lock was already taken over or removed by another process.
    }
  }
}

const tailLines = (text, count = 40) => {
  const trimmed = (text ?? "").trimEnd();
  return trimmed ? trimmed.split("\n").slice(-count).join("\n") : "";
};

function runGate(cwd, { tooling, env }) {
  const started = Date.now();
  if (env.AGY_GATE_CMD) {
    const res = spawnSync(env.AGY_GATE_CMD, {
      cwd,
      shell: true,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: GATE_TIMEOUT_MS,
    });
    const output = `${res.stdout ?? ""}${res.stderr ?? ""}${res.error ? `\n${res.error.message}` : ""}`;
    const seconds = Math.round((Date.now() - started) / 1000);
    return {
      ok: !res.error && res.status === 0,
      cmd: env.AGY_GATE_CMD,
      seconds,
      tail: tailLines(output),
    };
  }

  const commands = [
    { label: "npm run -s gate:quick", args: ["run", "-s", "gate:quick"] },
    ...(tooling ? [{ label: "npm run -s test:tooling", args: ["run", "-s", "test:tooling"] }] : []),
  ];
  for (const step of commands) {
    const res = spawnSync("npm", step.args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: GATE_TIMEOUT_MS,
    });
    if (res.error || res.status !== 0) {
      const output = `${res.stdout ?? ""}${res.stderr ?? ""}${res.error ? `\n${res.error.message}` : ""}`;
      return {
        ok: false,
        cmd: step.label,
        seconds: Math.round((Date.now() - started) / 1000),
        tail: tailLines(output),
      };
    }
  }
  return {
    ok: true,
    cmd: commands.map((c) => c.label).join(" && "),
    seconds: Math.round((Date.now() - started) / 1000),
    tail: "",
  };
}

const list = (items) => (items?.length ? items.map((i) => `\n  - ${i}`).join("") : " -");

function formatVerification(verification) {
  switch (verification.kind) {
    case "receipt":
      return `receipt ${verification.head.slice(0, 7)}`;
    case "ran":
      return `ran ${verification.cmd} ${verification.seconds}s pass`;
    case "failed":
      return `FAILED ${verification.cmd}`;
    case "skipped":
      return `skipped (${verification.reason})`;
    default:
      return "skipped (unknown)";
  }
}

/** Compact text the orchestrator reads instead of the raw transcript. */
export function formatSummary(opts, outcome, rawPath) {
  const { result, report, facts, verification, recoveredError } = outcome;
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
  if (recoveredError) {
    lines.push(`note: agy reported ${recoveredError} but the report was recovered`);
  }
  if (verification) {
    lines.push(`verified: ${formatVerification(verification)}`);
  }
  if (outcome.reviewFiles?.length) {
    lines.push(`review: gate-defining files changed: ${outcome.reviewFiles.join(", ")}`);
  }
  if (report) {
    lines.push(`summary: ${report.summary}`);
  }
  if (facts) {
    lines.push(
      `branch: ${facts.branch || "-"} | pr: ${report?.pr_url || "-"}`,
      `commits:${list(facts.commits)}`,
      `files:${list(facts.files)}`,
    );
    if (facts.dirty?.length) lines.push(`dirty:${list(facts.dirty)}`);
    if (facts.note) lines.push(`git note: ${facts.note}`);
  }
  if (report) {
    lines.push(`blockers:${list(report.blockers)}`, `follow_ups:${list(report.follow_ups)}`);
  } else if (result?.response) {
    lines.push(`response (no report): ${result.response.slice(0, 1500)}`);
  }
  if (verification?.kind === "failed" && verification.tail) {
    lines.push(`gate output (last 40 lines):\n${verification.tail}`);
  }
  if (rawPath) lines.push(`raw: ${relative(ROOT, rawPath)}`);
  return lines.join("\n");
}

/**
 * @param {string[]} [argv]
 * @param {Record<string, string | undefined>} [env]
 */
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

  const result = proc.error ? null : parseJsonOutput(proc.stdout);
  const report = result
    ? (coerceReport(result.structured_output) ?? reportFromText(result.response))
    : null;
  const facts = result ? gitFacts(opts.cwd, opts.base) : null;
  const receipt = result ? readReceipt(opts.cwd) : null;
  const requiredSteps = requiredStepsFor(facts?.files ?? []);
  const decision = decide({ proc, report, facts, receipt, requiredSteps });
  const recoveredError =
    report && result && result.status !== "SUCCESS" ? errorDetailOf(result, proc.stderr) : "";

  let code = decision.code;
  let reason = decision.reason;
  let finalFacts = facts;
  /** @type {Verification} */
  let verification;

  if (decision.verify) {
    const gate = withGateLock(opts.cwd, () =>
      runGate(opts.cwd, { tooling: requiredSteps.includes("test:tooling"), env }),
    );
    if (gate.ok) {
      const afterFacts = gitFacts(opts.cwd, opts.base);
      const changed =
        !afterFacts.head || afterFacts.head !== facts?.head || afterFacts.dirty.length > 0;
      if (changed) {
        finalFacts = afterFacts;
        code = 1;
        reason = "tree changed during verification";
        verification = { kind: "failed", cmd: gate.cmd, seconds: gate.seconds, tail: "" };
      } else {
        code = 0;
        reason = recoveredError ? `done (agy error: ${recoveredError})` : "done";
        verification = { kind: "ran", cmd: gate.cmd, seconds: gate.seconds };
      }
    } else {
      code = 1;
      reason = `gate failed (${gate.cmd})`;
      verification = { kind: "failed", cmd: gate.cmd, seconds: gate.seconds, tail: gate.tail };
    }
  } else if (decision.code === 0 && receipt) {
    verification = { kind: "receipt", head: receipt.head };
  } else {
    verification = { kind: "skipped", reason: decision.reason };
  }

  const reviewFiles = gateDefiningFiles(finalFacts?.files ?? []);
  const outcome = {
    code,
    reason,
    result,
    report,
    facts: finalFacts,
    verification,
    recoveredError,
    reviewFiles,
  };
  const dir = env.AGY_STATE_DIR || join(ROOT, ".claude/state/agy");
  mkdirSync(dir, { recursive: true });
  const rawPath = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${opts.role}.json`);
  writeFileSync(
    rawPath,
    JSON.stringify(
      {
        opts,
        exit: proc.status,
        result,
        facts: finalFacts,
        verification,
        reviewFiles,
        stderr: proc.stderr?.slice(-4000),
      },
      null,
      2,
    ),
  );
  console.log(formatSummary(opts, outcome, rawPath));
  return code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main();
