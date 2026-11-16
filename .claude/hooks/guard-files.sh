#!/usr/bin/env bash
# PreToolUse(file edits): block secrets, generated files and paths the project
# rules forbid. Exit 2 blocks the tool call. Shared by Claude Code and Copilot
# (chat.useClaudeHooks), so it accepts both payload shapes.
set -euo pipefail

input="$(cat)"
file="$(jq -r '.tool_input | .file_path // .filePath // .notebook_path // ""' <<<"$input")"
[[ -n "$file" ]] || exit 0
root="${CLAUDE_PROJECT_DIR:-$(jq -r '.cwd // empty' <<<"$input")}"
rel="${file#"${root:-$PWD}"/}"
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
