#!/usr/bin/env bash
# Continuous Learning v2 - Observation Hook
#
# Captures tool use events for pattern analysis.
# Claude Code / Cursor passes hook data via stdin as JSON.

set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" != "pre" && "$MODE" != "post" ]]; then
  echo "Usage: observe.sh pre|post" >&2
  exit 1
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
CONFIG_DIR="$PROJECT_DIR/.claude/homunculus"
OBSERVATIONS_FILE="$CONFIG_DIR/observations.jsonl"
MAX_FILE_SIZE_MB=10

mkdir -p "$CONFIG_DIR"

# Skip if disabled
if [[ -f "$CONFIG_DIR/disabled" ]]; then
  exit 0
fi

# Archive if file too large
if [[ -f "$OBSERVATIONS_FILE" ]]; then
  file_size_mb=$(du -m "$OBSERVATIONS_FILE" 2>/dev/null | cut -f1 || echo 0)
  if [[ "${file_size_mb:-0}" -ge "$MAX_FILE_SIZE_MB" ]]; then
    archive_dir="$CONFIG_DIR/observations.archive"
    mkdir -p "$archive_dir"
    mv "$OBSERVATIONS_FILE" "$archive_dir/observations-$(date +%Y%m%d-%H%M%S).jsonl"
  fi
fi

# Read stdin (may be empty)
INPUT_JSON="$(cat)"
if [[ -z "${INPUT_JSON}" ]]; then
  exit 0
fi

timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Parse JSON safely (no shell interpolation into Python code)
python3 <(cat <<'PY'
import json
import sys

mode = sys.argv[1]
timestamp = sys.argv[2]
out_path = sys.argv[3]

raw = sys.stdin.read()
if not raw.strip():
    sys.exit(0)

def trunc(v: object, limit: int = 5000) -> str:
    try:
        if isinstance(v, (dict, list)):
            s = json.dumps(v, ensure_ascii=False)
        else:
            s = str(v)
    except Exception:
        s = "<unserializable>"
    return s[:limit]

try:
    data = json.loads(raw)

    tool_name = data.get("tool_name") or data.get("tool") or "unknown"
    tool_input = data.get("tool_input") or data.get("input") or {}
    tool_output = data.get("tool_output") or data.get("output") or ""
    session_id = data.get("session_id") or "unknown"

    event = "tool_start" if mode == "pre" else "tool_complete"

    obs = {
        "timestamp": timestamp,
        "event": event,
        "tool": tool_name,
        "session": session_id,
    }
    if mode == "pre":
        obs["input"] = trunc(tool_input)
    else:
        obs["output"] = trunc(tool_output)

except Exception as e:
    obs = {
        "timestamp": timestamp,
        "event": "parse_error",
        "error": str(e),
        "raw": trunc(raw, 1000),
    }

with open(out_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(obs, ensure_ascii=False) + "\n")

PY
) "$MODE" "$timestamp" "$OBSERVATIONS_FILE" <<<"$INPUT_JSON"

# Signal observer if running
OBSERVER_PID_FILE="$CONFIG_DIR/.observer.pid"
if [[ -f "$OBSERVER_PID_FILE" ]]; then
  observer_pid=$(cat "$OBSERVER_PID_FILE" || true)
  if [[ -n "$observer_pid" ]] && kill -0 "$observer_pid" 2>/dev/null; then
    kill -USR1 "$observer_pid" 2>/dev/null || true
  fi
fi

exit 0
