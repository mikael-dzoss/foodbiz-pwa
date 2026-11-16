#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit|NotebookEdit): block secrets, generated
# files and paths the project rules forbid. Exit 2 blocks the tool call.
set -euo pipefail

file="$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')"
[[ -n "$file" ]] || exit 0
rel="${file#"${CLAUDE_PROJECT_DIR:-$PWD}"/}"
base="$(basename "$rel")"

block() {
  echo "Blocked by .claude/hooks/guard-files.sh: $rel: $1" >&2
  exit 2
}

case "$base" in
  .env.example) ;;
  .env | .env.*) block "secrets file (AGENTS.md rule 4); document new variables in .env.example and src/config/env.ts." ;;
  *.pem) block "key material is never edited by agents." ;;
esac

case "$rel" in
  middleware.ts | src/middleware.ts) block "src/proxy.ts replaces middleware (web.instructions.md)." ;;
  src/lib/supabase/database.types.ts) block "generated file; change a migration and run npm run db:types." ;;
  graphify-out/* | node_modules/* | .next/* | coverage/*) block "generated/vendored output." ;;
esac

exit 0
