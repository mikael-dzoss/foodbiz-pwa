#!/usr/bin/env bash
# ==============================================================================
# Helper script to seed or update extensions for Antigravity IDE.
# Extensions are persisted inside the Docker volume (/home/node/.gemini/antigravity-ide-extensions)
# via the symlink configured in .devcontainer/post-create.sh.
#
# Usage:
#   bash .devcontainer/install-extensions.sh
# ==============================================================================
set -euo pipefail

WAIT_SECONDS=0
if [[ "${1:-}" == "--wait" ]]; then
  WAIT_SECONDS="${2:-60}"
fi

find_cli() {
  find /home/node/.antigravity-ide-server/bin -name "antigravity-ide-server" -type f 2>/dev/null | head -n 1 || true
}

CLI_BIN=$(find_cli)

if [[ -z "${CLI_BIN}" || ! -x "${CLI_BIN}" ]] && [[ "${WAIT_SECONDS}" -gt 0 ]]; then
  echo "Waiting up to ${WAIT_SECONDS}s for antigravity-ide-server CLI to become available..."
  ELAPSED=0
  while [[ -z "${CLI_BIN}" || ! -x "${CLI_BIN}" ]] && [[ "${ELAPSED}" -lt "${WAIT_SECONDS}" ]]; do
    sleep 2
    ELAPSED=$((ELAPSED + 2))
    CLI_BIN=$(find_cli)
  done
fi

if [[ -z "${CLI_BIN}" || ! -x "${CLI_BIN}" ]]; then
  if [[ "${WAIT_SECONDS}" -gt 0 ]]; then
    echo "Antigravity IDE server CLI not found after ${WAIT_SECONDS}s (likely running in VS Code). Skipping extension seeding."
    exit 0
  else
    echo "Error: antigravity-ide-server CLI not found."
    echo "Please run this script inside an Antigravity IDE terminal session."
    exit 1
  fi
fi

EXTENSIONS=(
  "esbenp.prettier-vscode"
  "dbaeumer.vscode-eslint"
  "bradlc.vscode-tailwindcss"
  "vitest.explorer"
  "supabase.vscode-supabase-extension"
  "github.vscode-pull-request-github"
  "github.vscode-github-actions"
  "eamodio.gitlens"
  "redhat.vscode-yaml"
  "anthropic.claude-code"
)

echo "Ensuring Antigravity IDE extensions are installed..."
for ext in "${EXTENSIONS[@]}"; do
  "${CLI_BIN}" --install-extension "${ext}" 2>&1 | grep -v "depends on antigravityAnalytics" || true
done

# Install any custom .vsix packages placed in the persistent volume
if compgen -G "/home/node/.gemini/custom_extensions/*.vsix" > /dev/null; then
  for vsix in /home/node/.gemini/custom_extensions/*.vsix; do
    echo "Installing custom extension: $(basename "${vsix}")..."
    "${CLI_BIN}" --install-extension "${vsix}" 2>&1 | grep -v "depends on antigravityAnalytics" || true
  done
fi

echo "Antigravity IDE extensions check completed."
