#!/usr/bin/env node
// PreToolUse(shell): enforce AGENTS.md rule 7 even if husky is bypassed.
// Mirrors .husky/pre-commit + .husky/pre-push; exit 2 blocks the tool call.
// Shared by Claude Code and Copilot (chat.useClaudeHooks).
//
// The command is split into segments on && || ; | & and newlines (quotes,
// $(...) and heredocs respected) and every git segment is judged on its own,
// in the directory and branch that segment would really run in.
//
// Blocks:  commit/merge/push while on develop|staging|main; push to those
//          branches (any refspec form, --all, --mirror); --no-verify on
//          commit/merge/push; force pushes (-f, --force, +refspec) anywhere;
//          --force-with-lease to a protected branch.
// Allows:  --force-with-lease to a non-protected branch (stack restacks).
// Does not see: git run by other tools (`gh stack push|submit|sync` force-push
//          with --force-with-lease from inside gh; GitHub's own branch
//          protection is the backstop), or commands built at runtime.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PROTECTED = ["develop", "staging", "main"];
const OPERATORS = ["&&", "||", ";", "|", "&", "\n"];

/** Splits a shell command into segments of words, plus any $(...) bodies. */
export function parse(command) {
  const segments = [];
  const substitutions = [];
  let words = [];
  let word = null;
  let heredocs = [];
  let i = 0;

  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endSegment = () => {
    endWord();
    if (words.length) segments.push(words);
    words = [];
  };
  const readSubstitution = () => {
    // i points at "$(": copy to the matching ")" and remember the body.
    let depth = 0;
    const start = i;
    for (; i < command.length; i++) {
      if (command[i] === "(") depth++;
      if (command[i] === ")" && --depth === 0) break;
    }
    substitutions.push(command.slice(start + 2, i));
    word = (word ?? "") + command.slice(start, i + 1);
    i++;
  };

  while (i < command.length) {
    const c = command[i];
    if (c === "\\" && command[i + 1] === "\n") {
      i += 2;
    } else if (c === "\\") {
      word = (word ?? "") + (command[i + 1] ?? "");
      i += 2;
    } else if (c === "'") {
      const end = command.indexOf("'", i + 1);
      const stop = end === -1 ? command.length : end;
      word = (word ?? "") + command.slice(i + 1, stop);
      i = stop + 1;
    } else if (c === '"') {
      word ??= "";
      i++;
      while (i < command.length && command[i] !== '"') {
        if (command[i] === "$" && command[i + 1] === "(") readSubstitution();
        else if (command[i] === "\\" && i + 1 < command.length) word += command[(i += 2) - 1];
        else word += command[i++];
      }
      i++;
    } else if (c === "$" && command[i + 1] === "(") {
      readSubstitution();
    } else if (command.startsWith("<<", i) && command[i + 2] !== "<") {
      const match = /^<<(-?)\s*(?:'([^']*)'|"([^"]*)"|([^\s;&|()<>]+))/.exec(command.slice(i));
      if (match) {
        heredocs.push({ tag: match[2] ?? match[3] ?? match[4], strip: match[1] === "-" });
        i += match[0].length;
        endWord();
      } else {
        i += 2;
      }
    } else if (/\s/.test(c) && c !== "\n") {
      endWord();
      i++;
    } else {
      const operator = OPERATORS.find((op) => command.startsWith(op, i));
      if (operator) {
        endSegment();
        i += operator.length;
        if (operator === "\n") {
          for (const { tag, strip } of heredocs) {
            for (;;) {
              const eol = command.indexOf("\n", i);
              const line = command.slice(i, eol === -1 ? command.length : eol);
              i = eol === -1 ? command.length : eol + 1;
              if ((strip ? line.trim() : line) === tag || eol === -1) break;
            }
          }
          heredocs = [];
        }
      } else {
        word = (word ?? "") + c;
        i++;
      }
    }
  }
  endSegment();
  return { segments, substitutions };
}

const git = (cwd, ...args) => {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
};

const GLOBAL_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace"]);
const SHELLS = new Set(["bash", "sh", "zsh"]);

/** Returns a reason string when the command must be blocked, else null. */
export function evaluate(command, startDir) {
  let cwd = startDir;
  let branchOverride = null;

  const currentBranch = () => branchOverride ?? git(cwd, "symbolic-ref", "--short", "HEAD");

  const checkGit = (args) => {
    let dir = cwd;
    let i = 0;
    for (; i < args.length && args[i].startsWith("-"); i++) {
      const [flag] = args[i].split("=");
      if (flag === "-C") dir = resolve(dir, expand(args[++i] ?? "."));
      else if (GLOBAL_WITH_VALUE.has(args[i])) i++;
    }
    const [sub, ...rest] = args.slice(i);
    const flags = rest.filter((a) => a.startsWith("-") && a !== "-");
    const positional = rest.filter((a) => !a.startsWith("-") || a === "-");
    const here = () => branchOverride ?? git(dir, "symbolic-ref", "--short", "HEAD");
    const onProtected = () => PROTECTED.includes(here());

    if (["switch", "checkout"].includes(sub)) {
      const create = flags.some((f) =>
        ["-c", "-C", "-b", "-B", "--create", "--force-create"].includes(f),
      );
      const target = positional[0];
      if (create && target) branchOverride = target;
      else if (target && git(dir, "rev-parse", "--verify", "-q", `refs/heads/${target}`))
        branchOverride = target;
      return null;
    }

    if (!["commit", "merge", "push"].includes(sub)) return null;

    const noVerify =
      flags.includes("--no-verify") ||
      (sub === "commit" && flags.some((f) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(f)));
    if (noVerify) return "--no-verify bypasses the husky guards and lint-staged.";

    if (sub !== "push") {
      return onProtected()
        ? `'${here()}' is protected; create a feature/, bug/ or utils/ branch first.`
        : null;
    }

    if (flags.some((f) => ["--all", "--mirror"].includes(f)))
      return "--all/--mirror would push protected branches; push the branch by name.";

    const plainForce = flags.some(
      (f) => f === "--force" || (/^-[a-zA-Z]+$/.test(f) && f.includes("f")),
    );
    const lease = flags.some(
      (f) => f.startsWith("--force-with-lease") || f === "--force-if-includes",
    );
    const refspecs = positional.slice(1); // first positional is the remote
    if (plainForce || refspecs.some((r) => r.startsWith("+")))
      return "plain force-push (-f, --force, +refspec); use --force-with-lease on your own branch.";

    const targets = refspecs.length
      ? refspecs.map((r) => {
          const dst = r.includes(":") ? r.slice(r.lastIndexOf(":") + 1) : r;
          const name = dst.replace(/^refs\/heads\//, "");
          return name === "HEAD" || name === "" ? here() : name;
        })
      : [here()];
    const hit = targets.find((t) => PROTECTED.includes(t));
    if (hit)
      return lease
        ? `force-pushing protected branch '${hit}'; open a PR against develop.`
        : `pushing to protected branch '${hit}'; open a PR against develop.`;
    return null;
  };

  const checkSegment = (words) => {
    let i = 0;
    while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++;
    while (["command", "exec", "sudo", "time", "env", "nohup", "xargs"].includes(words[i])) i++;
    const [name, ...args] = words.slice(i);
    if (name === "cd" || name === "pushd") {
      cwd = resolve(cwd, expand(args.find((a) => !a.startsWith("-")) ?? "~"));
      branchOverride = null;
      return null;
    }
    if (SHELLS.has(name)) {
      const at = args.indexOf("-c");
      return at !== -1 && args[at + 1] ? evaluateString(args[at + 1]) : null;
    }
    if (name === "git") return checkGit(args);
    return null;
  };

  const evaluateString = (text) => {
    const { segments, substitutions } = parse(text);
    for (const words of segments) {
      const reason = checkSegment(words);
      if (reason) return reason;
    }
    for (const body of substitutions) {
      const reason = evaluateString(body);
      if (reason) return reason;
    }
    return null;
  };

  return evaluateString(command);
}

const expand = (path) => path.replace(/^~(?=$|\/)/, homedir());

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    console.error(
      "Blocked by .claude/hooks/guard-git.mjs: unreadable hook payload (failing closed).",
    );
    process.exit(2);
  }
  const command = input?.tool_input?.command ?? "";
  if (!command.includes("git")) return;
  const dir = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const reason = evaluate(command, resolve(dir));
  if (reason) {
    console.error(
      `Blocked by .claude/hooks/guard-git.mjs: ${reason} See docs/CONTRIBUTING.md#branches`,
    );
    process.exit(2);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
