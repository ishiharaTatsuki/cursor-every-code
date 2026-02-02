# Strategic Compact

Suggest manual compaction at **good breakpoints**, before the context gets so large that quality drops.

This repo implements it as a lightweight **PreToolUse hook** that counts tool calls and occasionally reminds you to compact.

## What it does

- Counts tool calls (Bash / Write / Edit / MultiEdit).
- When the count passes a threshold, prints a reminder like:
  - "Consider running `/compact` soon (after finishing this task)."
- Applies a cooldown so it doesn’t spam you.

## Where it lives

- Hook script: `./.cursor/scripts/hooks/suggest-compact.js`
- Hook wiring (third-party hooks): `./.claude/settings.json`

This repo already wires it in `PreToolUse` by default.

## Tuning

Set environment variables in your shell/session:

- `COMPACT_THRESHOLD` (default in script): how many tool calls before suggesting
- `COMPACT_COOLDOWN_MS` (default in script): minimum time between suggestions
- `ECC_DISABLE_SUGGEST_COMPACT=1`: disable entirely

## Notes

- `Stop` hook is **per assistant response**, not session end. For compact suggestions, PreToolUse tends to be a better trigger.
- The hook is **warn-only**: it never blocks tools.
