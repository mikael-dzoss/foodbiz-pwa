#!/usr/bin/env bash
# PreToolUse(shell): enforce AGENTS.md rule 7 even if husky is bypassed.
# Mirrors .husky/pre-commit + .husky/pre-push; exit 2 blocks the tool call.
# Shared by Claude Code and Copilot (chat.useClaudeHooks).
set -euo pipefail

input="$(cat)"
cmd="$(jq -r '.tool_input.command // ""' <<<"$input")"
[[ "$cmd" == *git* ]] || exit 0
root="${CLAUDE_PROJECT_DIR:-$(jq -r '.cwd // empty' <<<"$input")}"

protected='develop|staging|std|main'
block() {
  echo "Blocked by .claude/hooks/guard-git.sh: $1 See docs/CONTRIBUTING.md#branches" >&2
  exit 2
}

if grep -Eq -- '--no-verify' <<<"$cmd"; then
  block "--no-verify bypasses the husky guards and lint-staged."
fi

if grep -Eq 'git[[:space:]]+push' <<<"$cmd"; then
  if grep -Eq -- '(^|[[:space:]])(-f|--force)([[:space:]]|$)' <<<"$cmd"; then
    block "plain force-push; use --force-with-lease on your own branch."
  fi
  if grep -Eq "git[[:space:]]+push.*[[:space:]:+]($protected)([[:space:]]|$)" <<<"$cmd"; then
    block "pushing to a protected branch; open a PR against develop."
  fi
fi

if grep -Eq 'git[[:space:]]+(commit|push|merge)([[:space:]]|$)' <<<"$cmd"; then
  branch="$(git -C "${root:-.}" symbolic-ref --short HEAD 2>/dev/null || true)"
  if [[ "$branch" =~ ^($protected)$ ]]; then
    block "'$branch' is protected; create a feature/, bug/ or utils/ branch first."
  fi
fi

exit 0
