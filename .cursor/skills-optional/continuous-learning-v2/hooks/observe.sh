#!/bin/bash
# Continuous Learning v2 - Observation Hook
#
# Captures tool use events for pattern analysis.
# Hook runners pass hook data via stdin as JSON.
#
# SECURITY NOTE:
# - Do NOT interpolate raw JSON into Python source code.
# - Always pass JSON via stdin to avoid code injection via quotes.

set -e

CONFIG_DIR="./.claude/homunculus"
OBSERVATIONS_FILE="${CONFIG_DIR}/observations.jsonl"
MAX_FILE_SIZE_MB=10

# Ensure directory exists
mkdir -p "$CONFIG_DIR"

# Skip if disabled
if [ -f "$CONFIG_DIR/disabled" ]; then
  exit 0
fi

# Read JSON from stdin
INPUT_JSON="$(cat)"

# Exit if no input
if [ -z "$INPUT_JSON" ]; then
  exit 0
fi

# Parse safely using python via stdin (no shell interpolation into code)
PARSED=$(printf '%s' "$INPUT_JSON" | python3 <<'PY'
import json
import sys

raw = sys.stdin.read()

try:
    data = json.loads(raw)

    # Extract fields - hook format varies by runner
    hook_type = data.get('hook_type', 'unknown')  # e.g., PreToolUse / PostToolUse
    tool_name = data.get('tool_name', data.get('tool', 'unknown'))
    tool_input = data.get('tool_input', data.get('input', {}))
    tool_output = data.get('tool_output', data.get('output', ''))
    session_id = data.get('session_id', 'unknown')

    def trunc(x, limit=5000):
        if isinstance(x, (dict, list)):
            s = json.dumps(x, ensure_ascii=False)
        else:
            s = str(x)
        return s[:limit]

    # Determine event type
    event = 'tool_start' if 'Pre' in hook_type else 'tool_complete'

    out = {
        'parsed': True,
        'event': event,
        'tool': tool_name,
        'session': session_id,
    }

    if event == 'tool_start':
        out['input'] = trunc(tool_input)
    else:
        out['output'] = trunc(tool_output)

    print(json.dumps(out, ensure_ascii=False))
except Exception as e:
    print(json.dumps({'parsed': False, 'error': str(e)}, ensure_ascii=False))
PY
)

# Check if parsing succeeded
PARSED_OK=$(printf '%s' "$PARSED" | python3 -c "import json,sys; print(json.load(sys.stdin).get('parsed', False))")

if [ "$PARSED_OK" != "True" ]; then
  # Fallback: log raw input for debugging
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  raw=$(printf '%s' "$INPUT_JSON" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()[:1000]))')
  printf '{"timestamp":"%s","event":"parse_error","raw":%s}\n' "$timestamp" "$raw" >> "$OBSERVATIONS_FILE"
  exit 0
fi

# Archive if file too large
if [ -f "$OBSERVATIONS_FILE" ]; then
  file_size_mb=$(du -m "$OBSERVATIONS_FILE" 2>/dev/null | cut -f1)
  if [ "${file_size_mb:-0}" -ge "$MAX_FILE_SIZE_MB" ]; then
    archive_dir="${CONFIG_DIR}/observations.archive"
    mkdir -p "$archive_dir"
    mv "$OBSERVATIONS_FILE" "$archive_dir/observations-$(date +%Y%m%d-%H%M%S).jsonl"
  fi
fi

# Build and write observation
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
export OBSERVATIONS_FILE TIMESTAMP

printf '%s' "$PARSED" | python3 <<'PY'
import json
import os
import sys

parsed = json.load(sys.stdin)
observation = {
    'timestamp': os.environ.get('TIMESTAMP', ''),
    'event': parsed.get('event', 'unknown'),
    'tool': parsed.get('tool', 'unknown'),
    'session': parsed.get('session', 'unknown'),
}

if parsed.get('input'):
    observation['input'] = parsed['input']
if parsed.get('output'):
    observation['output'] = parsed['output']

with open(os.environ['OBSERVATIONS_FILE'], 'a', encoding='utf-8') as f:
    f.write(json.dumps(observation, ensure_ascii=False) + '\n')
PY

# Signal observer if running
OBSERVER_PID_FILE="${CONFIG_DIR}/.observer.pid"
if [ -f "$OBSERVER_PID_FILE" ]; then
  observer_pid=$(cat "$OBSERVER_PID_FILE")
  if kill -0 "$observer_pid" 2>/dev/null; then
    kill -USR1 "$observer_pid" 2>/dev/null || true
  fi
fi

exit 0
