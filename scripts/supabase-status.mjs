// Reads the running local Supabase stack (`supabase status -o env`) for scripts that need its URL and keys.
import { spawnSync } from "node:child_process";

/** Parses `KEY="value"` lines from `supabase status -o env`. */
export function parseStatus(output) {
  return Object.fromEntries(
    [...output.matchAll(/^([A-Z0-9_]+)="?([^"\n]*)"?$/gm)].map((m) => [m[1], m[2]]),
  );
}

/** Stack values, or undefined when the stack is not running. Tries the CLI on PATH, then the repo's. */
export function readStatus() {
  for (const cmd of [["supabase"], ["npx", "--no-install", "supabase"]]) {
    const run = spawnSync(cmd[0], [...cmd.slice(1), "status", "-o", "env"], { encoding: "utf8" });
    if (run.status === 0) return parseStatus(run.stdout);
  }
  return undefined;
}

/** Fixed id of the business created by supabase/seed.sql. */
export const SEED_BUSINESS_ID = "11111111-1111-4111-8111-111111111111";

/** Environment for a production build that prerenders the catalog from the local stack. */
export function buildEnv(status) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
    STOREFRONT_BUSINESS_ID: SEED_BUSINESS_ID,
    DATA_SOURCE: "supabase",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}
