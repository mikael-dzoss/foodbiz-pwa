// Dependency-free secret scanner for ADDED lines of a git diff. Works without any GitHub feature.
//
//   node scripts/secret-scan.mjs                 staged changes (pre-commit)
//   node scripts/secret-scan.mjs --base <ref>    merge-base(<ref>, HEAD)..HEAD (CI, gate)
//
// Exits 1 on findings. Findings are masked: the secret itself is never printed in full.
// Opt out of one line with the marker `secret-scan: ignore` in a comment on that line.
// Placeholders (xxx, example, placeholder, demo, test, fake, $VAR, <value>, ...) are allowed.
import { execFileSync } from "node:child_process";
import { resolveBase } from "./ci-scope.mjs";

export const IGNORE_MARKER = /secret-scan:\s*ignore/i;

const PLACEHOLDER =
  /x{3,}|\.{3}|\*{3}|0{8,}|placeholder|example|demo|dummy|changeme|change-me|redacted|your[-_ ]|fake|mock|test|<[^>]+>|\[[^\]]+\]|\$\{?[A-Za-z_]/i;

const SKIP_FILES = [/(^|\/)package-lock\.json$/, /\.lock$/, /^supabase\/\.(temp|branches)\//];

const b64urlJson = (part) => {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
};

/**
 * Each rule: `pattern` finds a candidate, `secret` picks the sensitive part of the match and
 * `allowed` may veto it (known-public values).
 * `placeholders: false` skips the generic placeholder allowlist for that rule.
 * @type {{ name: string, pattern: RegExp, placeholders?: boolean, secret?: (m: RegExpMatchArray) => string, allowed?: (secret: string) => boolean }[]}
 */
export const RULES = [
  {
    name: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}/,
    // Supabase's documented local-demo keys are public (iss "supabase-demo").
    placeholders: false,
    allowed: (token) =>
      b64urlJson(token.split(".")[1])?.iss === "supabase-demo" || /x{5,}/.test(token),
  },
  { name: "supabase-secret-key", pattern: /\bsb_secret_[A-Za-z0-9_-]{12,}/ },
  {
    name: "service-role-key",
    pattern: /(?:service[_-]?role|secret)[\w-]*["']?\s*[:=]\s*["']?([A-Za-z0-9._+/=-]{32,})/i,
    secret: (m) => m[1],
    // `secret: process.env.SOME_NAME` reads a variable; real keys contain digits.
    allowed: (value) => /^[A-Za-z_]+(?:\.[A-Za-z_]+)*$/.test(value),
  },
  { name: "github-token", pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/ },
  { name: "github-pat", pattern: /\bgithub_pat_[A-Za-z0-9_]{40,}/ },
  {
    name: "api-key-sk",
    pattern: /\bsk-(?:proj-|ant-[a-z0-9]+-)?[A-Za-z0-9_-]{32,}/,
    allowed: (token) => !/\d/.test(token),
  },
  { name: "aws-access-key-id", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  {
    name: "private-key",
    pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/,
    placeholders: false,
  },
  {
    name: "postgres-url-password",
    pattern: /\bpostgres(?:ql)?:\/\/[^:\s/@]+:([^@\s]+)@/,
    secret: (m) => m[1],
    // The Supabase local stack and docs use `postgres`/`password` style passwords.
    allowed: (password) => /^(postgres|password|pass|secret|admin|root)$/i.test(password),
  },
  { name: "vercel-token", pattern: /\bvc[a-z]_[A-Za-z0-9]{20,}/ },
  {
    name: "vercel-token",
    pattern: /VERCEL[A-Z_]*TOKEN["']?\s*[:=]\s*["']?([A-Za-z0-9]{24,})/,
    secret: (m) => m[1],
  },
];

/** `abcd…wxyz (N chars)`: enough to find the line, never the whole secret. */
export function mask(secret) {
  if (secret.length <= 8) return `${secret.slice(0, 1)}*** (${secret.length} chars)`;
  return `${secret.slice(0, 4)}…${secret.slice(-2)} (${secret.length} chars)`;
}

/** Findings for one added line. */
export function scanLine(line) {
  if (IGNORE_MARKER.test(line)) return [];
  const findings = [];
  for (const rule of RULES) {
    const match = line.match(rule.pattern);
    if (!match) continue;
    const secret = rule.secret ? rule.secret(match) : match[0];
    if (rule.allowed?.(secret)) continue;
    if (rule.placeholders !== false && PLACEHOLDER.test(secret)) continue;
    findings.push({ rule: rule.name, masked: mask(secret) });
  }
  return findings;
}

/**
 * Scans a unified diff (`git diff -U0`) and returns findings on ADDED lines only.
 * @param {string} diff
 * @returns {{ file: string, line: number, rule: string, masked: string }[]}
 */
export function scanDiff(diff) {
  const out = [];
  let file = "";
  let line = 0;
  for (const text of diff.split("\n")) {
    if (text.startsWith("+++ ")) {
      file = text.startsWith("+++ b/") ? text.slice(6) : "";
      continue;
    }
    if (text.startsWith("--- ") || text.startsWith("diff ")) continue;
    const hunk = text.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (text.startsWith("+")) {
      if (file && !SKIP_FILES.some((p) => p.test(file)))
        for (const f of scanLine(text.slice(1))) out.push({ file, line, ...f });
      line += 1;
    }
  }
  return out;
}

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

function main(argv) {
  const baseAt = argv.indexOf("--base");
  const diffArgs = ["diff", "--no-color", "-U0", "--no-ext-diff", "--diff-filter=ACMR"];
  let diff;
  if (baseAt === -1) {
    diff = git(...diffArgs, "--cached");
  } else {
    // Unknown base (first push, unreachable SHA): scan everything rather than nothing.
    diff = git(...diffArgs, resolveBase(argv[baseAt + 1]) ?? EMPTY_TREE, "HEAD");
  }
  const findings = scanDiff(diff);
  for (const f of findings)
    console.error(
      `${f.file}:${f.line}  possible ${f.rule}: ${f.masked}\n    (placeholder? add "secret-scan: ignore" in a comment on that line)`,
    );
  if (findings.length > 0) {
    console.error(`\nsecret-scan: ${findings.length} possible secret(s) in added lines.`);
    process.exit(1);
  }
  console.log("secret-scan: clean");
}

if (process.argv[1]?.endsWith("secret-scan.mjs")) main(process.argv.slice(2));
