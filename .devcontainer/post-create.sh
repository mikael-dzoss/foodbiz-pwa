#!/usr/bin/env bash
set -euo pipefail

# Volume mounts are created root-owned; hand them to the node user.
# .gemini: Antigravity extension / agy state; .claude: Claude Code config, auth and memory.
sudo mkdir -p /home/node/.gemini /home/node/.claude node_modules
sudo chown -R node:node /home/node/.gemini /home/node/.claude node_modules

npm ci

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example — fill in your Supabase values."
fi

# Build the graphify knowledge graph once (AST-only, no API key) so agents can
# `graphify query` from the first session; hooks keep it current afterwards.
if command -v graphify >/dev/null 2>&1 && [ ! -f graphify-out/graph.json ]; then
  graphify update . >/tmp/graphify-update.log 2>&1 || echo "graphify update failed; see /tmp/graphify-update.log"
fi
