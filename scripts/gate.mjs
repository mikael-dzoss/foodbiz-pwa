// One-command local validation gate (see docs/CONTRIBUTING.md#validation-gate).
//
//   npm run gate         tiers needed by what changed (scripts/ci-scope.mjs)
//   npm run gate:quick   format, lint, typecheck, unit tests
//   npm run gate:full    every tier, whatever changed
//
// Same tiers, commands and order as .github/workflows/ci.yml: check, integration, e2e.
// Stops at the first failure (CI instead reports every failure of a tier), prints the tail of
// its output and a pass/fail table with timings.
import { spawnSync } from "node:child_process";
import { changedFiles, defaultBase, needsIntegration, scopeFor } from "./ci-scope.mjs";
import { readStatus } from "./supabase-status.mjs";

const npm = (script) => ({ name: script, cmd: ["npm", "run", "-s", script] });

const SUPABASE_START_HELP = [
  "Supabase is not running, and this change needs the integration tier. Start it, then re-run the gate:",
  "  npm run db:start      (or, lighter: npx supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime,mailpit)",
  "  npm run gate",
  "Stop it afterwards with `npm run db:stop` to free memory.",
];

/**
 * @param {ReturnType<typeof scopeFor>} scope
 * @param {"auto" | "quick" | "full"} mode
 * @param {{ base?: string }} [options] `base` is the ref the secret scan diffs against (staged changes when omitted)
 * @returns {{ tier: string, steps: { name: string, cmd?: string[], run?: () => { ok: boolean, output: string } }[] }[]}
 */
export function plan(scope, mode = "auto", { base } = {}) {
  const { tiers, check } = scope;
  if (mode === "quick") {
    return [
      {
        tier: "quick",
        steps: [npm("format:check"), npm("lint"), npm("typecheck"), npm("test")],
      },
    ];
  }
  const full = mode === "full";
  const secretScan = {
    name: "secret-scan",
    cmd: ["node", "scripts/secret-scan.mjs", ...(base ? ["--base", base] : [])],
  };
  const checkSteps = [secretScan, npm("format:check")];
  if (!check.formatOnly || full) {
    checkSteps.push(npm("lint"), npm("typecheck"));
    if (check.dbTypes || full) checkSteps.push(npm("db:types:check"));
    if (check.unit || full) checkSteps.push(npm("test:coverage"));
    checkSteps.push({ name: "audit", cmd: ["npm", "audit", "--omit=dev", "--audit-level=high"] });
    if (check.tooling || full) checkSteps.push(npm("test:tooling"));
  }
  const tiersPlan = [{ tier: "check", steps: checkSteps }];

  const integration = [];
  if (full || tiers.db) integration.push(npm("db:test"), { name: "test:live", run: runLive });
  if (full || tiers.build) integration.push(npm("build:local"));
  if (full || tiers.journey) integration.push(npm("test:e2e:supabase"));
  if (full || needsIntegration(scope))
    tiersPlan.push({
      tier: "integration",
      steps: [{ name: "supabase", run: ensureStack }, ...integration],
    });
  if (full || tiers.e2e) tiersPlan.push({ tier: "e2e", steps: [npm("test:e2e")] });
  return tiersPlan;
}

const exec = (cmd, env = {}) => {
  const result = spawnSync(cmd[0], cmd.slice(1), {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
};

function ensureStack() {
  const status = readStatus();
  return status ? { ok: true, output: "" } : { ok: false, output: SUPABASE_START_HELP.join("\n") };
}

function runLive() {
  const vars = readStatus() ?? {};
  return exec(["npm", "run", "-s", "test:live"], {
    SUPABASE_TEST_URL: vars.API_URL,
    SUPABASE_TEST_SERVICE_ROLE_KEY: vars.SERVICE_ROLE_KEY,
    SUPABASE_TEST_ANON_KEY: vars.ANON_KEY,
  });
}

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

function main(argv) {
  const mode = argv.includes("--quick") ? "quick" : argv.includes("--full") ? "full" : "auto";
  const baseAt = argv.indexOf("--base");
  const base = baseAt === -1 ? defaultBase() : argv[baseAt + 1];
  const scope = scopeFor(mode === "full" ? [] : changedFiles(base));
  const steps = plan(scope, mode, { base }).flatMap(({ tier, steps: s }) =>
    s.map((step) => ({ tier, ...step })),
  );

  console.error(
    `gate ${mode}: ${scope.files.length} changed file(s) vs ${base.slice(0, 9)}; tiers: ${[...new Set(steps.map((s) => s.tier))].join(", ")}`,
  );
  const rows = [];
  let failure;
  for (const step of steps) {
    process.stderr.write(`> ${step.tier}: ${step.name} ...\n`);
    const started = Date.now();
    const result = step.run ? step.run() : exec(step.cmd);
    rows.push({ ...step, ok: result.ok, took: Date.now() - started });
    if (!result.ok) {
      failure = { step, output: result.output };
      break;
    }
  }

  if (failure) {
    const tail = failure.output.trimEnd().split("\n").slice(-60).join("\n");
    console.error(`\n--- ${failure.step.name} failed (last 60 lines) ---\n${tail}\n`);
  }
  const width = Math.max(...rows.map((r) => r.name.length), 4);
  console.log(`\n${"step".padEnd(width)}  tier         result  time`);
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(width)}  ${r.tier.padEnd(11)}  ${r.ok ? "PASS  " : "FAIL  "}  ${seconds(r.took)}`,
    );
  }
  const total = rows.reduce((sum, r) => sum + r.took, 0);
  console.log(`${failure ? "GATE FAILED" : "GATE PASSED"} in ${seconds(total)}`);
  process.exit(failure ? 1 : 0);
}

if (process.argv[1]?.endsWith("gate.mjs")) main(process.argv.slice(2));
