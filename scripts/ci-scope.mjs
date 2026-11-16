// Decides which validation tiers a change needs. Used by `npm run gate` locally
// and meant to be reused by CI (path rules live in RULES only).
//
//   node scripts/ci-scope.mjs [--base <ref>] [--github-output] [--files a b ...]
//
// Prints JSON; with --github-output also appends `check=true|false` (and build,
// e2e, db, format_only, db_types, tooling) lines to $GITHUB_OUTPUT.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const PACKAGE = /^package(-lock)?\.json$/;
const APP = [
  /^src\//,
  /^public\//,
  /^next\.config\./,
  PACKAGE,
  /^tsconfig[^/]*\.json$/,
  /^postcss\.config\./,
  /^tailwind\.config\./,
];

/** Path rules, one regex list per tier. Everything else is judged by `docsOnly`. */
export const RULES = {
  docsOnly: [/\.md$/, /^docs\//],
  build: APP,
  e2e: [...APP, /^e2e\//, /^playwright\.config\./],
  db: [
    /^supabase\//,
    /^src\/lib\/repositories\//,
    /^src\/lib\/supabase\//,
    /^src\/domain\/repositories\//,
    /database\.types\.ts$/,
    PACKAGE,
  ],
  dbTypes: [/^supabase\//, /database\.types\.ts$/, /^scripts\/db-types/],
  tooling: [
    /^scripts\//,
    /^\.agents\/skills\/[^/]+\/scripts\//,
    /^\.claude\/hooks\//,
    /^\.github\//,
    /^vitest\.tooling\.config\./,
  ],
};

const any = (files, patterns) => files.some((f) => patterns.some((p) => p.test(f)));

/**
 * @param {string[]} files changed paths relative to the repo root
 * @returns {{ files: string[], tiers: { check: true, build: boolean, e2e: boolean, db: boolean },
 *   check: { formatOnly: boolean, dbTypes: boolean, tooling: boolean } }}
 */
export function scopeFor(files) {
  const formatOnly = files.every((f) => RULES.docsOnly.some((p) => p.test(f)));
  const tier = (name) => !formatOnly && any(files, RULES[name]);
  return {
    files,
    tiers: { check: true, build: tier("build"), e2e: tier("e2e"), db: tier("db") },
    check: { formatOnly, dbTypes: tier("dbTypes"), tooling: tier("tooling") },
  };
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

/** Merge-base with origin/develop (or develop), falling back to the previous commit. */
export function defaultBase() {
  for (const ref of ["origin/develop", "develop"]) {
    try {
      return git("merge-base", "HEAD", ref);
    } catch {
      // try the next ref
    }
  }
  return "HEAD~1";
}

/** Files changed since `base`: committed, staged, unstaged and untracked. */
export function changedFiles(base) {
  const lines = (out) => out.split("\n").filter(Boolean);
  const tracked = lines(git("diff", "--name-only", base));
  const untracked = lines(git("ls-files", "--others", "--exclude-standard"));
  return [...new Set([...tracked, ...untracked])].toSorted();
}

function main(argv) {
  const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const filesAt = argv.indexOf("--files");
  const files =
    filesAt === -1
      ? changedFiles(value("--base") ?? defaultBase())
      : argv.slice(filesAt + 1).filter((a) => !a.startsWith("--"));
  const scope = scopeFor(files);
  console.log(JSON.stringify(scope, null, 2));
  if (argv.includes("--github-output")) {
    const lines = [
      ...Object.entries(scope.tiers),
      ["format_only", scope.check.formatOnly],
      ["db_types", scope.check.dbTypes],
      ["tooling", scope.check.tooling],
    ].map(([key, on]) => `${key}=${on}`);
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
    else console.log(lines.join("\n"));
  }
}

if (process.argv[1]?.endsWith("ci-scope.mjs")) main(process.argv.slice(2));
