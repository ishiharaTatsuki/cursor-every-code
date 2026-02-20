# Strategic Compact

Suggest manual compaction at **good breakpoints**, before the context gets so large that quality drops.

This repo implements it as a lightweight **PreToolUse hook** that counts tool calls and occasionally reminds you to compact.

## What it does

- Counts tool calls (Bash / Write / Edit / MultiEdit).
- When the count hits a threshold (default: **50**), prints a reminder like:
  - "Consider running `/compact` if you are transitioning phases"
- After the threshold, it reminds again every **25** tool calls.

## Where it lives

- Hook script: `./.cursor/scripts/hooks/suggest-compact.js`
- Hook wiring (third-party hooks): `./.claude/settings.json`

This repo already wires it in `PreToolUse` by default.

## Tuning

Environment variables:

- `COMPACT_THRESHOLD` (default: `50`): how many tool calls before suggesting

## How counting works

- The hook persists a counter in your OS temp directory:
  - `claude-tool-count-<sessionId>`
- `sessionId` is taken from `CLAUDE_SESSION_ID` if present, otherwise it falls back to the parent process ID.

To reset the counter, delete the corresponding temp file (or start a new session).

## Notes

- `Stop` hook is **per assistant response**, not session end. For compact suggestions, PreToolUse tends to be the best trigger.
- The hook is **warn-only**: it never blocks tools.
