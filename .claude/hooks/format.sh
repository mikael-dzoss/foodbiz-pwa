#!/usr/bin/env bash
# PostToolUse(file edits): Prettier (+ Tailwind class sorting) on the edited
# file, so lint-staged has nothing left to fix at commit time. Never fails the
# turn: formatting problems surface in `npm run format:check`.
set -uo pipefail

input="$(cat)"
file="$(jq -r '.tool_input | .file_path // .filePath // ""' <<<"$input")"
[[ -f "$file" ]] || exit 0
case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs | *.json | *.css | *.md | *.yml | *.yaml) ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-$(jq -r '.cwd // empty' <<<"$input")}"
cd "${root:-.}" || exit 0
prettier="node_modules/.bin/prettier"
[[ -x "$prettier" ]] || exit 0
"$prettier" --write --ignore-unknown --log-level warn "$file" >/dev/null 2>&1 || true
exit 0
