---
trigger: model_decision
description: Antigravity only. Use when Stitch or Vercel MCP tools are missing in Antigravity and the servers must be registered via the agy CLI
---

# MCP Server Management for Agents

When a task requires tools from an external service (such as Stitch for mobile screens or Vercel for deployment logs/inspection) and the corresponding tools are not present in your active tool list, verify and register the MCP server using the Antigravity CLI.

> Copilot reads [`.vscode/mcp.json`](../../.vscode/mcp.json) and Claude Code reads [`.mcp.json`](../../.mcp.json); this rule applies to Antigravity only.

## 1. CLI Path Resolution
The `agy` CLI may not be in system `$PATH` by default. Always resolve the binary path first:

```bash
AGY_BIN="$(command -v agy || echo "/home/node/.gemini/bin/agy")"
```

## 2. Google Stitch MCP
Required for screen generation, canvas inspection, and design system syncing ([SCREENS.md](../../docs/design/SCREENS.md)).

```bash
if [[ -z "${STITCH_API_KEY:-}" ]]; then
  echo "STITCH_API_KEY is not set in environment. Ask the user or verify host forwarding."
elif ! "$AGY_BIN" mcp list 2>/dev/null | grep -q "^stitch "; then
  "$AGY_BIN" mcp add --header "X-Goog-Api-Key: ${STITCH_API_KEY}" stitch https://stitch.googleapis.com/mcp
  echo "Stitch MCP server registered successfully."
fi
```

## 3. Vercel MCP
Required for project inspection, deployment logs, and remote diagnostics.

```bash
if [[ -z "${VERCEL_API_TOKEN:-}" ]]; then
  echo "VERCEL_API_TOKEN is not set in environment. Ask the user or verify host forwarding."
elif ! "$AGY_BIN" mcp list 2>/dev/null | grep -q "^vercel "; then
  "$AGY_BIN" mcp add --header "Authorization: Bearer ${VERCEL_API_TOKEN}" vercel https://mcp.vercel.com
  echo "Vercel MCP server registered successfully."
fi
```

