#!/usr/bin/env bash
set -euo pipefail

# Volume mounts are created root-owned; hand them to the node user.
sudo mkdir -p /home/node/.gemini /home/node/.antigravity-ide-server /home/node/.claude node_modules
sudo chown -R node:node /home/node/.gemini /home/node/.antigravity-ide-server /home/node/.claude node_modules

# Persist Antigravity IDE extensions across container rebuilds via the mounted .gemini volume
mkdir -p /home/node/.gemini/antigravity-ide-extensions /home/node/.antigravity-ide-server
if [ -d /home/node/.antigravity-ide-server/extensions ] && [ ! -L /home/node/.antigravity-ide-server/extensions ]; then
  cp -rn /home/node/.antigravity-ide-server/extensions/* /home/node/.gemini/antigravity-ide-extensions/ 2>/dev/null || true
  rm -rf /home/node/.antigravity-ide-server/extensions
fi
ln -sfn /home/node/.gemini/antigravity-ide-extensions /home/node/.antigravity-ide-server/extensions
npm ci

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example — fill in your Supabase values."
fi

# Seed extensions in the background if running under Antigravity IDE (waits up to 60s for server CLI)
nohup bash .devcontainer/install-extensions.sh --wait 60 > /tmp/install-extensions.log 2>&1 &
