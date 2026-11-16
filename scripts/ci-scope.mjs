// Decides which validation tiers a change needs. Single source of truth shared by
// `npm run gate` (local) and .github/workflows/ci.yml (CI): path rules live in RULES only.
//
//   node scripts/ci-scope.mjs [--base <ref>] [--all] [--files a b ...] [--github-output]
//   node scripts/ci-scope.mjs --pr <baseRef> <headSha> <headRef> [--github-output]
//   node scripts/ci-scope.mjs --push <beforeSha> [--github-output]
//
// Prints JSON; with --github-output also appends `key=value` lines to $GITHUB_OUTPUT.
//
// Unknown or unreachable bases fail safe to "every tier" (never to "nothing").
// --pr is the stack-aware mode: expensive tiers (integration, e2e) run only for PRs that
// target a protected branch or sit on top of a stack; middle-of-stack PRs run `check` only.
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
const DB = [
  /^supabase\//,
  /^src\/lib\/repositories\//,
  /^src\/lib\/supabase\//,
  /^src\/domain\/repositories\//,
  /database\.types\.ts$/,
  PACKAGE,
];

export const PROTECTED = ["develop", "staging", "main"];
export const TRUNK = "develop";

/** Path rules, one regex list per tier. Everything else is judged by `docsOnly`. */
export const RULES = {
  docsOnly: [/\.md$/, /^docs\//],
  build: APP,
  e2e: [...APP, /^e2e\//, /^playwright\.config\./],
  db: DB,
  // The Supabase-mode Playwright journey: app code, anything the DB layer touches, and its own files.
  journey: [
    ...APP,
    ...DB,
    /^e2e-supabase\//,
    /^playwright\.supabase\.config\./,
    /^scripts\/(e2e-supabase|build-local|supabase-status)\./,
  ],
  // The CI definition itself: the only way to prove an edit to it is to run every tier.
  everything: [/^\.github\/workflows\/ci\.yml$/, /^scripts\/ci-scope\./],
  // Unit tests only import src/: scripts, workflows, e2e specs and SQL cannot change their result.
  unit: [
    /^src\//,
    PACKAGE,
    /^vitest\.config\./,
    /^tsconfig[^/]*\.json$/,
    /^next\.config\./,
    /^\.nvmrc$/,
  ],
  dbTypes: [/^supabase\//, /database\.types\.ts$/, /^scripts\/db-types/],
  tooling: [
    /^scripts\//,
    /^\.agents\/skills\/[^/]+\/scripts\//,
    /^\.claude\/hooks\//,
    /^\.github\//,
    /^\.husky\//,
    /^vitest\.tooling\.config\./,
  ],
};

const any = (files, patterns) => files.some((f) => patterns.some((p) => p.test(f)));

/**
 * @param {string[]} files changed paths relative to the repo root
 * @param {{ all?: boolean }} [options] `all` forces every tier (unknown base, manual run, gate:full)
 */
export function scopeFor(files, { all = false } = {}) {
  if (all) {
    return {
      files,
      tiers: { check: true, build: true, e2e: true, db: true, journey: true },
      check: { formatOnly: false, unit: true, dbTypes: true, tooling: true },
    };
  }
  const formatOnly = files.every((f) => RULES.docsOnly.some((p) => p.test(f)));
  const everything = !formatOnly && any(files, RULES.everything);
  const tier = (name) => everything || (!formatOnly && any(files, RULES[name]));
  return {
    files,
    tiers: {
      check: true,
      build: tier("build"),
      e2e: tier("e2e"),
      db: tier("db"),
      journey: tier("journey"),
    },
    check: {
      formatOnly,
      unit: everything || tier("unit"),
      dbTypes: everything || tier("dbTypes"),
      tooling: tier("tooling"),
    },
  };
}

/** The expensive tiers need a Supabase stack (integration job) or a browser (e2e job). */
export const needsIntegration = (scope) =>
  scope.tiers.build || scope.tiers.db || scope.tiers.journey;

/** Same scope with the expensive tiers switched off (their need is reported as `deferred`). */
export function deferExpensive(scope) {
  const deferred = needsIntegration(scope) || scope.tiers.e2e;
  return {
    ...scope,
    tiers: { check: true, build: false, e2e: false, db: false, journey: false },
    deferred,
  };
}

/**
 * Pure stack decision for a PR.
 * @param {{ baseRef: string, otherBranchesContainingHead: string[] }} pr
 */
export function prPolicy({ baseRef, otherBranchesContainingHead }) {
  if (PROTECTED.includes(baseRef))
    return { expensive: true, base: `origin/${baseRef}`, reason: `base is ${baseRef}` };
  if (otherBranchesContainingHead.length === 0)
    return {
      expensive: true,
      base: `origin/${TRUNK}`,
      reason: `top of its stack (base ${baseRef}): the whole stack is judged against ${TRUNK}`,
    };
  return {
    expensive: false,
    base: `origin/${baseRef}`,
    reason: `middle of a stack (base ${baseRef}, contained in ${otherBranchesContainingHead.join(", ")}): expensive tiers run on the top PR and on the bottom PR`,
  };
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const tryGit = (...args) => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
};

const ZERO_SHA = /^0+$/;

/** Merge-base of `ref` and HEAD, or undefined when `ref` is empty, all zeros or not in the clone. */
export function resolveBase(ref) {
  if (!ref || ZERO_SHA.test(ref)) return undefined;
  if (tryGit("cat-file", "-e", `${ref}^{commit}`) === undefined) return undefined;
  return tryGit("merge-base", ref, "HEAD") ?? ref;
}

/** Merge-base with origin/develop (or develop), falling back to the previous commit. */
export function defaultBase() {
  for (const ref of ["origin/develop", "develop"]) {
    const base = tryGit("merge-base", "HEAD", ref);
    if (base) return base;
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

/**
 * Post-merge scope for a push. A merge commit whose tree equals its second parent's tree is exactly
 * the PR head that already passed the required check, so nothing needs re-running; otherwise (develop
 * moved after the PR's last run, squash/rebase merges, promotions with extra commits) judge before..after.
 */
export function pushScope(before) {
  const tree = (rev) => tryGit("rev-parse", `${rev}^{tree}`);
  const head = tree("HEAD");
  if (head && tryGit("rev-parse", "--verify", "HEAD^2") && head === tree("HEAD^2"))
    return {
      scope: scopeFor([]),
      base: "",
      reason: "merge commit tree equals its PR head tree, already verified by the PR run",
    };
  const base = resolveBase(before);
  return {
    scope: base ? scopeFor(changedFiles(base)) : scopeFor([], { all: true }),
    base: base ?? "",
    reason: base ? "merge diff (before..after)" : "base unknown: every tier",
  };
}

/** Remote branches other than the PR's own and the protected ones that contain `headSha`. */
export function otherBranchesContaining(headSha, headRef) {
  const out = tryGit(
    "for-each-ref",
    "--contains",
    headSha,
    "--format=%(refname:short)",
    "refs/remotes/origin",
  );
  // Commit not in the clone (e.g. a fork): treat as a lone top-of-stack PR (fail safe).
  if (out === undefined) return [];
  const ignored = new Set([
    "origin",
    "origin/HEAD",
    `origin/${headRef}`,
    ...PROTECTED.map((b) => `origin/${b}`),
  ]);
  return out.split("\n").filter((b) => b && !ignored.has(b));
}

/** `key=value` lines for $GITHUB_OUTPUT. */
export function outputLines(scope, extra = {}) {
  const { tiers, check } = scope;
  const integration = needsIntegration(scope);
  return Object.entries({
    check: true,
    integration,
    int_db: tiers.db,
    int_build: tiers.build,
    int_journey: tiers.journey,
    e2e: tiers.e2e,
    format_only: check.formatOnly,
    unit: check.unit,
    db_types: check.dbTypes,
    tooling: check.tooling,
    deferred: Boolean(scope.deferred),
    files: scope.files.length,
    ...extra,
  }).map(([key, value]) => `${key}=${value}`);
}

function main(argv) {
  const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const filesAt = argv.indexOf("--files");
  const prAt = argv.indexOf("--pr");
  let scope;
  let extra = {};

  if (filesAt !== -1) {
    scope = scopeFor(argv.slice(filesAt + 1).filter((a) => !a.startsWith("--")));
  } else if (argv.includes("--push")) {
    const pushed = pushScope(value("--push"));
    scope = pushed.scope;
    extra = { base: pushed.base, reason: pushed.reason };
  } else if (argv.includes("--all")) {
    scope = scopeFor([], { all: true });
    extra = { base: "", reason: "manual run: every tier" };
  } else if (prAt !== -1) {
    const [baseRef, headSha, headRef] = argv.slice(prAt + 1);
    const policy = prPolicy({
      baseRef,
      otherBranchesContainingHead: PROTECTED.includes(baseRef)
        ? []
        : otherBranchesContaining(headSha, headRef),
    });
    const base = resolveBase(policy.base);
    const raw = base ? scopeFor(changedFiles(base)) : scopeFor([], { all: true });
    scope = policy.expensive ? raw : deferExpensive(raw);
    extra = { base: base ?? "", expensive: policy.expensive, reason: policy.reason };
  } else {
    const explicit = value("--base");
    const base = explicit === undefined ? defaultBase() : resolveBase(explicit);
    scope = base ? scopeFor(changedFiles(base)) : scopeFor([], { all: true });
    extra = { base: base ?? "", reason: base ? "diff" : "base unknown: every tier" };
  }

  console.log(JSON.stringify({ ...scope, ...extra }, null, 2));
  if (argv.includes("--github-output")) {
    const lines = outputLines(scope, extra);
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
    else console.log(lines.join("\n"));
  }
}

if (process.argv[1]?.endsWith("ci-scope.mjs")) main(process.argv.slice(2));
