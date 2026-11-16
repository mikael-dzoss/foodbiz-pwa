#!/usr/bin/env bash
# SessionStart: surface the issue behind the current branch (<type>/<n>-slug)
# with its labels, so agents see `status:` / `priority:` before planning.
# Prints one line (stdout becomes session context); silent on any failure.
set -uo pipefail

input="$(cat 2>/dev/null || true)"
root="${CLAUDE_PROJECT_DIR:-$(jq -r '.cwd // empty' <<<"$input" 2>/dev/null)}"
branch="${SESSION_CONTEXT_BRANCH:-$(git -C "${root:-.}" symbolic-ref --short HEAD 2>/dev/null)}"

[[ "$branch" =~ ^[a-z]+/([0-9]+)- ]] || exit 0
issue="${BASH_REMATCH[1]}"
echo "Branch $branch → issue #$issue."

command -v gh >/dev/null 2>&1 || exit 0
info="$(cd "${root:-.}" && timeout 5 gh issue view "$issue" --json title,state,labels \
  --jq '"\(.title) [\(.state)] labels: \([.labels[].name] | join(", "))"' 2>/dev/null)" || exit 0
[[ -n "$info" ]] && echo "#$issue $info"
exit 0
