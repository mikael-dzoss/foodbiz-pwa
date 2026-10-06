#!/usr/bin/env bash
set -euo pipefail

# Volume mounts are created root-owned; hand them to the node user.
sudo mkdir -p /home/node/.gemini node_modules
sudo chown -R node:node /home/node/.gemini node_modules

npm ci

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example — fill in your Supabase values."
fi
