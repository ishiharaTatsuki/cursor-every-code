---
name: strategic-compact
description: Suggests manual context compaction at logical intervals to preserve intent and reduce drift.
---

# Strategic Compact Skill

Suggests manual `/compact` at logical points rather than relying on arbitrary auto-compaction.

## Why Strategic Compaction?

Auto-compaction triggers at arbitrary points:
- Often mid-task, losing important context
- No awareness of logical task boundaries
- Can interrupt complex multi-step operations

Strategic compaction at logical boundaries:
- **After exploration, before execution** — compact research context, keep implementation plan
- **After completing a milestone** — fresh start for next phase
- **Before a major context shift** — clear old threads before switching topics

## How It Works

The hook script runs on `PreToolUse` for `Edit|Write` and:

1. **Tracks tool calls** — counts tool invocations for the current session
2. **Threshold detection** — suggests at a configurable threshold (default: 50 tool calls)
3. **Periodic reminders** — reminds every 25 calls after threshold

## Hook Setup (Third-party Claude Code compatible)

In `./.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.cursor/scripts/hooks/suggest-compact.js\""
          }
        ]
      }
    ]
  }
}
```

## Configuration

Environment variables:
- `COMPACT_THRESHOLD` — tool calls before first suggestion (default: 50)

## Best Practices

1. **Compact after planning** — once the plan is finalized, compact to start fresh
2. **Compact after debugging** — clear error-resolution context before continuing
3. **Don't compact mid-implementation** — preserve context for related changes
4. **Use compaction as a handoff** — end one phase, begin the next

## Notes

- This is a *suggestion* system. You choose when to compact.
- If you find it too chatty, raise `COMPACT_THRESHOLD`.
