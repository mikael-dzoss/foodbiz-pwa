#!/usr/bin/env bash
# Antigravity only reads a per-user MCP config, so write the Stitch entry there from the host's STITCH_API_KEY.
set -euo pipefail

if [[ -z "${STITCH_API_KEY:-}" ]]; then
  echo "STITCH_API_KEY is not set on the host; skipping Antigravity Stitch MCP setup."
  exit 0
fi

node <<'EOF'
const fs = require("node:fs");
const path = require("node:path");

const candidates = [".gemini/config/mcp_config.json", ".gemini/antigravity/mcp_config.json"].map(
  (p) => path.join(process.env.HOME, p),
);
const file = candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
const current = config.mcpServers?.stitch ?? {
  serverUrl: "https://stitch.googleapis.com/mcp",
  headers: { Accept: "application/json" },
};
const stitch = {
  ...current,
  headers: { ...current.headers, "X-Goog-Api-Key": process.env.STITCH_API_KEY },
};

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(
  file,
  `${JSON.stringify({ ...config, mcpServers: { ...config.mcpServers, stitch } }, null, 2)}\n`,
  { mode: 0o600 },
);
fs.chmodSync(file, 0o600);
console.log(`Stitch MCP configured for Antigravity in ${file}`);
EOF
