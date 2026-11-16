#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit): Prettier (+ Tailwind class sorting) on the
# edited file, so lint-staged has nothing left to fix at commit time.
# Never fails the turn: formatting problems surface in `npm run format:check`.
set -uo pipefail

file="$(jq -r '.tool_input.file_path // ""')"
[[ -f "$file" ]] || exit 0
case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs | *.json | *.css | *.md | *.yml | *.yaml) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
prettier="node_modules/.bin/prettier"
[[ -x "$prettier" ]] || exit 0
"$prettier" --write --ignore-unknown --log-level warn "$file" >/dev/null 2>&1 || true
exit 0
