#!/usr/bin/env bash
# Link this checkout's skill into Claude Code (~/.claude/skills) and Codex (~/.agents/skills).
# usage: ./install.sh [--claude] [--codex]   (no flag: both). Update later with `git pull`; the links follow.
set -euo pipefail
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/skills/feature-demo-video"
targets=()
for arg in "$@"; do
  case "$arg" in
    --claude) targets+=("$HOME/.claude/skills") ;;
    --codex) targets+=("$HOME/.agents/skills") ;;
    *) echo "usage: ./install.sh [--claude] [--codex]" >&2; exit 64 ;;
  esac
done
[ ${#targets[@]} -gt 0 ] || targets=("$HOME/.claude/skills" "$HOME/.agents/skills")

for dir in "${targets[@]}"; do
  mkdir -p "$dir"
  link="$dir/feature-demo-video"
  if [ -e "$link" ] && [ ! -L "$link" ]; then
    echo "skipped $link: a real folder is there; move it away and run this again" >&2
    continue
  fi
  ln -sfn "$SKILL" "$link"
  echo "linked $link"
done

echo "Next, once per Mac: $SKILL/scripts/setup-local-voice.sh   (~5 GB of models under ~/.cache)"
