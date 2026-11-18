#!/usr/bin/env node
// agy (Antigravity CLI) PreToolUse hook for the foodbiz-* Gemini agents,
// wired through .agents/agents/foodbiz-hooks.json. agy does not run the Claude
// hooks, so this adapter reuses them instead of copying their rules:
//   run_command -> .claude/hooks/guard-git.mjs evaluate(), plus .env* access
//                  and `gh pr merge` (the orchestrator merges, not the agent)
//   file writes -> .claude/hooks/guard-files.sh (payload reshaped)
//   file reads  -> .env* only
// A deny holds even under `agy -p --dangerously-skip-permissions`.
// Prints {"decision":"deny","reason"} to block, {"decision":"allow"} to pass (agy
// treats a missing decision as a deny); fails closed. The foodbiz-* agents only
// run headless with --dangerously-skip-permissions, so "allow" grants nothing new.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate } from "../.claude/hooks/guard-git.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const GUARD_FILES = resolve(here, "../.claude/hooks/guard-files.sh");

// `.env` or `.env.<x>` as a path segment, except `.env.example`.
const ENV_FILE = /(^|[\s'"=/<>:@])\.env(?!\.example(?![\w.-]))(\.[\w.-]+)?(?=$|[\s'";|&)<>])/;
const WRITE_TOOL = /write|edit|replace|create|delete|move|rename|patch/i;

const ALLOW = Object.freeze({ decision: "allow" });
const deny = (reason) => ({
  decision: "deny",
  reason: `Blocked by scripts/agy-guard.mjs: ${reason}`,
});

/** Paths named in a tool call's arguments (Path, TargetFile, AbsolutePath, ...). */
function pathsOf(args) {
  return Object.entries(args ?? {})
    .filter(([key, value]) => /path|file/i.test(key) && typeof value === "string" && value)
    .map(([, value]) => value);
}

function checkCommand(command, cwd) {
  if (ENV_FILE.test(command)) return deny("secrets file (.env*); only .env.example is readable.");
  if (/\bgh\s+pr\s+merge\b/.test(command))
    return deny("the orchestrator merges PRs; push and report the PR URL instead.");
  const reason = evaluate(command, cwd);
  return reason ? deny(`${reason} See docs/CONTRIBUTING.md#branches`) : null;
}

function checkWrite(file, root) {
  const result = spawnSync("bash", [GUARD_FILES], {
    input: JSON.stringify({ tool_input: { file_path: file }, cwd: root }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  if (result.status === 0) return null;
  const message = (result.stderr || "").replace(
    /^Blocked by \.claude\/hooks\/guard-files\.sh: /,
    "",
  );
  return deny(message.trim() || `guard-files.sh exited ${result.status} (failing closed).`);
}

/**
 * Decides one agy PreToolUse payload.
 * @param {any} payload
 * @returns {{ decision: "allow" | "deny", reason?: string }}
 */
export function decide(payload) {
  const call = payload?.toolCall;
  if (!call?.name) return deny("unreadable hook payload (failing closed).");
  const root = resolve(payload.workspacePaths?.[0] || payload.cwd || process.cwd());
  const cwd = resolve(payload.cwd || root);

  const command = call.args?.CommandLine;
  if (typeof command === "string") return checkCommand(command, cwd) ?? ALLOW;

  for (const raw of pathsOf(call.args)) {
    const file = isAbsolute(raw) ? raw : resolve(cwd, raw);
    if (!WRITE_TOOL.test(call.name)) {
      if (ENV_FILE.test(file)) return deny("secrets file (.env*); only .env.example is readable.");
      continue;
    }
    const blocked = checkWrite(file, root);
    if (blocked) return blocked;
  }
  return ALLOW;
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    payload = null;
  }
  process.stdout.write(JSON.stringify(decide(payload)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
