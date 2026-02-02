#!/usr/bin/env bash
set -euo pipefail

# Safe observation hook for continuous-learning-v2
#
# Usage:
#   observe.sh pre   < hook_input_json
#   observe.sh post  < hook_input_json
#
# This script avoids code injection by parsing JSON via stdin (no string interpolation).

MODE="${1:-}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Where to store local state/logs (project-local by default)
CONFIG_DIR="${ECC_HOMUNCULUS_DIR:-"${PROJECT_DIR}/.claude/homunculus"}"
OBS_LOG="${CONFIG_DIR}/observations.jsonl"

# Resolve instinct-cli location
if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
  INSTINCT_CLI="${CLAUDE_PLUGIN_ROOT}/scripts/instinct-cli.py"
else
  INSTINCT_CLI="${PROJECT_DIR}/.cursor/skills/continuous-learning-v2/scripts/instinct-cli.py"
fi

if ! command -v python3 >/dev/null 2>&1; then
  # If python3 isn't available, silently skip.
  exit 0
fi

# Read full input JSON from stdin
INPUT_JSON="$(cat)"

EVENT="unknown"
if [[ "${MODE}" == "pre" ]]; then
  EVENT="tool_start"
elif [[ "${MODE}" == "post" ]]; then
  EVENT="tool_complete"
fi

mkdir -p "${CONFIG_DIR}"

# Build a sanitized observation JSON (avoid embedding large file contents)
OBSERVATION_JSON="$(printf '%s' "${INPUT_JSON}" | python3 - "${EVENT}" <<'PY'
import json, sys, datetime

event = sys.argv[1] if len(sys.argv) > 1 else "unknown"

try:
    data = json.load(sys.stdin)
except Exception:
    data = {}

tool = data.get("tool_name") or data.get("tool") or data.get("toolName") or ""
ti = data.get("tool_input") or data.get("toolInput") or {}

# Keep only a small subset of tool_input to avoid huge logs
safe_ti = {}
for k in ("command", "file_path", "filePath", "path", "args", "cwd"):
    if k in ti and ti[k] is not None:
        safe_ti[k] = ti[k]

obs = {
    "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
    "event": event,
    "session_id": data.get("session_id") or data.get("sessionId"),
    "tool": tool,
    "tool_input": safe_ti,
}

print(json.dumps(obs, ensure_ascii=False))
PY
)"

# Append to local log
printf '%s\n' "${OBSERVATION_JSON}" >> "${OBS_LOG}"

# Send to instinct-cli if present (non-blocking)
if [[ -f "${INSTINCT_CLI}" ]]; then
  printf '%s' "${OBSERVATION_JSON}" | python3 "${INSTINCT_CLI}" observe --event "${EVENT}" >/dev/null 2>&1 || true
fi

exit 0
