#!/usr/bin/env bash
set -euo pipefail

# Volume mounts are created root-owned; hand them to the node user.
# .gemini: Antigravity extension state; .claude: Claude Code config, auth and memory;
# .claude/worktrees: agent worktrees on a Linux volume (avoids the macOS bind-mount overhead).
sudo mkdir -p /home/node/.gemini /home/node/.claude node_modules .claude/worktrees
sudo chown -R node:node /home/node/.gemini /home/node/.claude node_modules .claude/worktrees

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

# Authenticate GitHub CLI if GH_CLI_PAT is provided via devcontainer env.
if command -v gh >/dev/null 2>&1 && [ -n "${GH_CLI_PAT:-}" ]; then
  if printf '%s\n' "$GH_CLI_PAT" | env -u GH_TOKEN -u GITHUB_TOKEN gh auth login --hostname github.com --git-protocol https --with-token; then
    gh auth setup-git --hostname github.com >/dev/null 2>&1 || true
    echo "Authenticated gh CLI via GH_CLI_PAT."
  else
    echo "Warning: gh auth login failed; check GH_CLI_PAT." >&2
  fi
fi
