// Raises global coverage thresholds in vitest.config.mts toward a cap; never lowers them. Branches stay fixed.
import { readFileSync, writeFileSync } from "node:fs";

export const CAP = 70;
const RATCHETED = ["lines", "functions", "statements"];

/**
 * @param {string} config vitest config source
 * @param {Record<string, { pct: number }>} totals `total` from coverage-summary.json
 * @param {number} [cap]
 * @returns {{ config: string, changes: string[] }}
 */
export function ratchet(config, totals, cap = CAP) {
  const start = config.indexOf("thresholds:");
  if (start === -1) throw new Error("coverage.thresholds not found");
  let block = config.slice(start);
  const changes = [];
  for (const key of RATCHETED) {
    const pattern = new RegExp(`(\\b${key}:\\s*)(\\d+(?:\\.\\d+)?)`);
    const match = pattern.exec(block);
    if (!match) throw new Error(`threshold "${key}" not found`);
    const current = Number(match[2]);
    const target = Math.max(current, Math.min(cap, Math.floor(totals[key].pct)));
    if (target !== current) {
      block = block.replace(pattern, `$1${target}`);
      changes.push(`${key}: ${current} → ${target}`);
    }
  }
  return { config: config.slice(0, start) + block, changes };
}

if (process.argv[1]?.endsWith("coverage-ratchet.mjs")) {
  const configPath = "vitest.config.mts";
  const { total } = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8"));
  const { config, changes } = ratchet(readFileSync(configPath, "utf8"), total);
  if (changes.length > 0) {
    writeFileSync(configPath, config);
    console.log(`Coverage thresholds raised (commit ${configPath}): ${changes.join(", ")}`);
  }
}
