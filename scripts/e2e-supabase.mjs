// Runs the Supabase-backed storefront journey against the local Supabase stack.
// Prerequisite: `npm run db:start` (or CI's `supabase start`). Reads the stack's URL and keys
// from `supabase status`; nothing is hard-coded or committed.
import { spawnSync } from "node:child_process";

const status = spawnSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });
if (status.status !== 0) {
  console.error("Could not read `supabase status`. Is the local stack running (npm run db:start)?");
  process.exit(1);
}

const values = Object.fromEntries(
  status.stdout
    .split("\n")
    .map((line) => line.match(/^([A-Z0-9_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
);

const publishableKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY;
const serviceKey = values.SECRET_KEY ?? values.SERVICE_ROLE_KEY;
if (!values.API_URL || !publishableKey || !serviceKey) {
  console.error("`supabase status` did not report API_URL and API keys.");
  process.exit(1);
}

const run = spawnSync(
  "npx",
  ["playwright", "test", "-c", "playwright.supabase.config.ts", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      E2E_SUPABASE_URL: values.API_URL,
      E2E_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      E2E_SUPABASE_SERVICE_KEY: serviceKey,
    },
  },
);
process.exit(run.status ?? 1);
