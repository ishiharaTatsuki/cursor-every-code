#!/usr/bin/env bash
# Continuous Learning - Session Evaluator (project-local)
# Runs on Stop hook to extract reusable patterns from Claude Code sessions
#
# Why Stop hook instead of UserPromptSubmit:
# - Stop runs once at session end (lightweight)
# - UserPromptSubmit runs every message (heavy, adds latency)
#
# Recommended hook config (project-level .cursor/settings.json):
# {
#   "hooks": {
#     "Stop": [{
#       "matcher": "*",
#       "hooks": [{
#         "type": "command",
#         "command": "bash -lc '\"$CLAUDE_PROJECT_DIR/.cursor/skills/continuous-learning/evaluate-session.sh\"'"
#       }]
#     }]
#   }
# }
#
# Notes:
# - This version is designed to keep all reads/writes inside the project directory.
# - learned_skills_path in config.json is resolved relative to PROJECT_ROOT (not $HOME).
#
# Patterns to detect: error_resolution, debugging_techniques, workarounds, project_specific
# Patterns to ignore: simple_typos, one_time_fixes, external_api_issues

set -euo pipefail

log() { printf "%s\n" "$*" >&2; }
has_cmd() { command -v "$1" >/dev/null 2>&1; }

# Resolve real path without requiring GNU realpath
realpath_compat() {
  local p="$1"
  # Normalize backslashes if any (Windows configs)
  p="${p//\\//}"

  if has_cmd realpath; then
    realpath "$p"
    return 0
  fi

  if has_cmd python3; then
    python3 - "$p" <<'PY'
import os,sys
print(os.path.realpath(sys.argv[1]))
PY
    return 0
  fi

  if has_cmd python; then
    python - "$p" <<'PY'
import os,sys
print(os.path.realpath(sys.argv[1]))
PY
    return 0
  fi

  # Last resort (not fully normalized)
  printf "%s" "$p"
}

trim() {
  local s="$1"
  # shellcheck disable=SC2001
  s="$(printf "%s" "$s" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  printf "%s" "$s"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Determine project root:
# 1) CLAUDE_PROJECT_DIR if set
# 2) git root (from script location)
# 3) walk up until .git/.cursor/.cursor found
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$PROJECT_ROOT" ]; then
  if has_cmd git; then
    PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
  fi
fi
if [ -z "$PROJECT_ROOT" ]; then
  d="$SCRIPT_DIR"
  PROJECT_ROOT="$SCRIPT_DIR"
  while [ "$d" != "/" ] && [ "$d" != "$(dirname "$d")" ]; do
    if [ -d "$d/.git" ] || [ -d "$d/.cursor" ] || [ -d "$d/.cursor" ]; then
      PROJECT_ROOT="$d"
      break
    fi
    d="$(dirname "$d")"
  done
fi

CONFIG_FILE="$SCRIPT_DIR/config.json"

DEFAULT_MIN_SESSION_LENGTH=10
DEFAULT_LEARNED_REL=".cursor/skills/learned/"

MIN_SESSION_LENGTH="$DEFAULT_MIN_SESSION_LENGTH"
LEARNED_SKILLS_PATH="$PROJECT_ROOT/${DEFAULT_LEARNED_REL%/}"

# Resolve a path so it stays within PROJECT_ROOT.
# Rules:
# - "~/" or "~" => treated as project root (NOT $HOME)
# - relative paths => resolved against PROJECT_ROOT
# - absolute paths => allowed only if they still sit under PROJECT_ROOT
resolve_in_project() {
  local raw="$1"
  raw="$(trim "$raw")"

  if [ -z "$raw" ] || [ "$raw" = "null" ]; then
    raw="$DEFAULT_LEARNED_REL"
  fi

  # Normalize backslashes (Windows)
  raw="${raw//\\//}"

  # Treat ~ as project root, not HOME
  if [[ "$raw" == "~/"* ]]; then
    raw="./${raw#~/}"
  elif [[ "$raw" == "~" ]]; then
    raw="."
  fi

  # Controlled expansion (we do NOT expand $HOME)
  raw="${raw//\$\{CLAUDE_PROJECT_DIR\}/$PROJECT_ROOT}"
  raw="${raw//\$CLAUDE_PROJECT_DIR/$PROJECT_ROOT}"
  raw="${raw//\$\{PROJECT_ROOT\}/$PROJECT_ROOT}"
  raw="${raw//\$PROJECT_ROOT/$PROJECT_ROOT}"

  local joined
  if [[ "$raw" == /* ]] || [[ "$raw" =~ ^[A-Za-z]:/ ]]; then
    joined="$raw"
  elif [[ "$raw" == ./* ]]; then
    joined="$PROJECT_ROOT/${raw#./}"
  else
    joined="$PROJECT_ROOT/$raw"
  fi

  local abs_root abs_joined
  abs_root="$(realpath_compat "$PROJECT_ROOT")"
  abs_joined="$(realpath_compat "$joined")"

  case "$abs_joined" in
    "$abs_root"|"${abs_root}/"*) ;;
    *)
      log "[ContinuousLearning] ERROR: learned_skills_path escapes project root."
      log "[ContinuousLearning]   project root : $abs_root"
      log "[ContinuousLearning]   resolved path : $abs_joined"
      exit 1
      ;;
  esac

  printf "%s" "$abs_joined"
}

# Load config if exists
if [ -f "$CONFIG_FILE" ]; then
  if has_cmd jq; then
    MIN_SESSION_LENGTH="$(jq -r '.min_session_length // 10' "$CONFIG_FILE")"

    RAW_LEARNED_PATH="$(jq -r ".learned_skills_path // \"${DEFAULT_LEARNED_REL}\"" "$CONFIG_FILE")"
    LEARNED_SKILLS_PATH="$(resolve_in_project "$RAW_LEARNED_PATH")"
  else
    log "[ContinuousLearning] WARNING: config.json exists but jq is not installed; using defaults."
  fi
else
  # Defaults already set
  LEARNED_SKILLS_PATH="$(resolve_in_project "$DEFAULT_LEARNED_REL")"
fi

# Ensure learned skills directory exists (inside project)
mkdir -p "$LEARNED_SKILLS_PATH"

# Get transcript path from environment (set by Claude Code)
transcript_path="${CLAUDE_TRANSCRIPT_PATH:-}"

if [ -z "$transcript_path" ] || [ ! -f "$transcript_path" ]; then
  exit 0
fi

# Count messages in session
message_count="$(grep -c '"type":"user"' "$transcript_path" 2>/dev/null || echo "0")"

# Skip short sessions
if [ "$message_count" -lt "$MIN_SESSION_LENGTH" ]; then
  log "[ContinuousLearning] Session too short ($message_count messages), skipping"
  exit 0
fi

# Signal to Claude that session should be evaluated for extractable patterns
log "[ContinuousLearning] Session has $message_count messages - evaluate for extractable patterns"
log "[ContinuousLearning] Save learned skills to: $LEARNED_SKILLS_PATH"
