#!/bin/sh
# Host side (devcontainer initializeCommand): create the private env file that
# devcontainer.json passes to docker --env-file; docker run fails without it.
set -eu

LOCAL_HOME="${1:-$HOME}"
WORKSPACE_BASENAME="${2:-foodbiz-pwa}"

DATA_DIR="${LOCAL_HOME}/.devcontainer-data/${WORKSPACE_BASENAME}"
ENV_FILE="${DATA_DIR}/env"

mkdir -p "${DATA_DIR}"

if [ ! -f "${ENV_FILE}" ]; then
  cat <<'EOF' > "${ENV_FILE}"
# Private devcontainer environment variables for foodbiz-pwa
# This file lives on your host machine and is never committed to git.
#
# WARNING: Do NOT wrap values in quotes! Docker passes quotes literally.
# Correct:   STITCH_API_KEY=AIzaSy...
# Incorrect: STITCH_API_KEY="AIzaSy..."
#
# GH_CLI_PAT=
# STITCH_API_KEY=
# VERCEL_API_TOKEN=
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
EOF
  chmod 600 "${ENV_FILE}" 2>/dev/null || true
fi
