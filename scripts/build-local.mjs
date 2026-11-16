// `next build` against the running local Supabase stack. The storefront prerenders its catalog at
// build time and a failed read fails the build, so a placeholder URL cannot work.
// Same command in CI (integration job) and in `npm run gate`.
import { spawnSync } from "node:child_process";
import { buildEnv, readStatus } from "./supabase-status.mjs";

const status = readStatus();
if (!status?.API_URL) {
  console.error("Local Supabase is not running. Start it with `npm run db:start`, then retry.");
  process.exit(1);
}
const run = spawnSync("npm", ["run", "-s", "build"], {
  stdio: "inherit",
  env: { ...process.env, ...buildEnv(status) },
});
process.exit(run.status ?? 1);
