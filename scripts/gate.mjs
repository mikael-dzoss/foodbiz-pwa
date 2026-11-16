// One-command local validation gate (see docs/CONTRIBUTING.md#validation-gate).
//
//   npm run gate         tiers needed by what changed (scripts/ci-scope.mjs)
//   npm run gate:quick   format, lint, typecheck, unit tests
//   npm run gate:full    every tier, whatever changed
//
// Runs tiers cheapest first (check, db, build, e2e), stops at the first
// failure, prints its output tail and a pass/fail table with timings.
import { spawnSync } from "node:child_process";
import { changedFiles, defaultBase, scopeFor } from "./ci-scope.mjs";

const npm = (script) => ({ name: script, cmd: ["npm", "run", "-s", script] });

const SUPABASE_START_HELP = [
  "Supabase is not running, and this change needs the db tier. Start it, then re-run the gate:",
  "  npm run db:start      (or, lighter: npx supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime,mailpit)",
  "  npm run gate",
  "Stop it afterwards with `npm run db:stop` to free memory.",
];

/**
 * @param {ReturnType<typeof scopeFor>} scope
 * @param {"auto" | "quick" | "full"} mode
 * @returns {{ tier: string, steps: { name: string, cmd?: string[], run?: () => { ok: boolean, output: string } }[] }[]}
 */
export function plan(scope, mode = "auto") {
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
  const checkSteps = [npm("format:check")];
  if (!check.formatOnly || full) {
    checkSteps.push(npm("lint"), npm("typecheck"));
    if (check.dbTypes || full) checkSteps.push(npm("db:types:check"));
    checkSteps.push(npm("test:coverage"));
    if (check.tooling || full) checkSteps.push(npm("test:tooling"));
  }
  const tiersPlan = [{ tier: "check", steps: checkSteps }];
  if (full || tiers.db)
    tiersPlan.push({ tier: "db", steps: [{ name: "db:test+live", run: runDb }] });
  if (full || tiers.build)
    tiersPlan.push({ tier: "build", steps: [{ name: "build", run: runBuild }] });
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

function runBuild() {
  // Same placeholders CI uses; a real .env.local or exported values win.
  const env = {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ci-placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "ci-placeholder-key",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  return exec(["npm", "run", "-s", "build"], env);
}

function runDb() {
  const status = exec(["npx", "supabase", "status", "-o", "env"]);
  if (!status.ok) return { ok: false, output: SUPABASE_START_HELP.join("\n") };
  const vars = Object.fromEntries(
    [...status.output.matchAll(/^([A-Z0-9_]+)="?([^"\n]*)"?$/gm)].map((m) => [m[1], m[2]]),
  );
  const pgtap = exec(["npm", "run", "-s", "db:test"]);
  if (!pgtap.ok) return pgtap;
  const live = exec(["npm", "run", "-s", "test:live"], {
    SUPABASE_TEST_URL: vars.API_URL,
    SUPABASE_TEST_SERVICE_ROLE_KEY: vars.SERVICE_ROLE_KEY,
    SUPABASE_TEST_ANON_KEY: vars.ANON_KEY,
  });
  return { ok: live.ok, output: pgtap.output + live.output };
}

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

function main(argv) {
  const mode = argv.includes("--quick") ? "quick" : argv.includes("--full") ? "full" : "auto";
  const baseAt = argv.indexOf("--base");
  const base = baseAt === -1 ? defaultBase() : argv[baseAt + 1];
  const scope = scopeFor(mode === "full" ? [] : changedFiles(base));
  const steps = plan(scope, mode).flatMap(({ tier, steps: s }) =>
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
  console.log(`\n${"step".padEnd(width)}  tier   result  time`);
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(width)}  ${r.tier.padEnd(5)}  ${r.ok ? "PASS  " : "FAIL  "}  ${seconds(r.took)}`,
    );
  }
  const total = rows.reduce((sum, r) => sum + r.took, 0);
  console.log(`${failure ? "GATE FAILED" : "GATE PASSED"} in ${seconds(total)}`);
  process.exit(failure ? 1 : 0);
}

if (process.argv[1]?.endsWith("gate.mjs")) main(process.argv.slice(2));
