#!/usr/bin/env bash
# Stop: keep graphify-out/ current after code changes (graphify.instructions.md).
# AST-only, no API cost; runs in the background and only when src/ changed
# since the last refresh. Silently skipped when graphify isn't provisioned.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v graphify >/dev/null 2>&1 || exit 0
[[ -d graphify-out ]] || exit 0

sig="$({ git status --porcelain -- src; git diff -- src; git rev-parse HEAD; } 2>/dev/null | sha1sum | cut -d' ' -f1)"
stamp="graphify-out/.claude-update-stamp"
[[ "$(cat "$stamp" 2>/dev/null)" == "$sig" ]] && exit 0
echo "$sig" >"$stamp"

nohup graphify update . >graphify-out/.claude-update.log 2>&1 &
exit 0
